import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Icon from './Icon';
import Brand from './Brand';
import { api, ApiError, login, logout } from './api';
import type { Session, Station, Equipment, Provider, Incident } from './types';

type Page = 'dashboard' | 'equipment' | 'history' | 'providers';
const pages: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'grid' }, { id: 'equipment', label: 'Équipements', icon: 'tools' },
  { id: 'history', label: 'Historique', icon: 'clock' }, { id: 'providers', label: 'Prestataires', icon: 'users' },
];
const levels: Record<string, [string, string]> = { VERT: ['green', 'Moins de 48 h'], ORANGE: ['orange', 'À surveiller · 48–72 h'], ROUGE: ['red', 'Critique · 72 h et plus'], AFFECTE: ['assigned', 'Pris en charge'], RESOLU: ['resolved', 'Résolu'] };
const date = (value: string) => new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
const duration = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
const message = (error: unknown) => error instanceof Error ? error.message : 'Une erreur est survenue.';
const isOperational = (equipment: Equipment) => ['OPERATIONNEL', 'FONCTIONNEL'].includes(equipment.etatFonctionnement);
function Badge({ level }: { level: string }) {
  const [style, label] = levels[level] ?? ['', level];
  return <span className={`status-badge ${style}`}><span className="status-dot" />{label}</span>;
}
function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [page, setPage] = useState<Page>('dashboard');
  const [stations, setStations] = useState<Station[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [active, setActive] = useState<Incident[]>([]);
  const [history, setHistory] = useState<Incident[]>([]);
  const [station, setStation] = useState('');
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Incident | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [equipmentIncidents, setEquipmentIncidents] = useState<Incident[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const manager = session?.profil === 'RESPONSABLE';
  async function refresh() {
    setLoading(true);
    try {
      const [s, e, p, a, h] = await Promise.all([api<Station[]>('/stations'), api<Equipment[]>('/equipements'), api<Provider[]>('/prestataires'), api<Incident[]>('/incidents'), api<Incident[]>('/incidents?historique=true')]);
      setStations(s); setEquipment(e); setProviders(p); setActive(a); setHistory(h);
      setSelected(current => current ? a.concat(h).find(i => i.id === current.id) ?? null : null);
      setSelectedEquipment(current => current ? e.find(item => item.id === current.id) ?? null : null);
      setSelected(current => current ? a.concat(h).find(i => i.id === current.id) ?? null : null);
      setSelectedEquipment(current => current ? e.find(item => item.id === current.id) ?? null : null); setUpdated(new Date()); setLoaded(true); setError('');
      return { active: a, history: h };
    } catch (err) { setError(message(err)); throw err; }
    finally { setLoading(false); }
  }
  useEffect(() => {
    api<Session>('/session').then(setSession).catch(err => { if (err.status !== 401) setError(message(err)); }).finally(() => setInitializing(false));
    const expired = () => { setSession(null); setSelected(null); setCreating(false); setSelectedEquipment(null); setLoaded(false); setError('Votre session a expiré. Reconnectez-vous.'); };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  useEffect(() => {
    if (!session) return;
    void refresh().catch(() => {});
    const timer = window.setInterval(() => void refresh().catch(() => {}), 60000);
    return () => window.clearInterval(timer);
  }, [session]);
  async function changed(id?: number) {
    const result = await refresh();
    if (id) setSelected(result.active.concat(result.history).find(i => i.id === id) ?? null);
    if (selectedEquipment) setEquipmentIncidents(await api<Incident[]>(`/incidents?equipementId=${selectedEquipment.id}`));
  }
  async function openEquipment(e: Equipment) {
    try { const items = await api<Incident[]>(`/incidents?equipementId=${e.id}`); setEquipmentIncidents(items); setSelectedEquipment(e); }
    catch (err) { setError(message(err)); }
  }
  const matches = (e: Equipment, text: string) => (!station || e.station.id === Number(station)) && `${text} ${e.libelle} ${e.reference} ${e.station.nom}`.toLowerCase().includes(search.toLowerCase());
  const visible = (page === 'history' ? history : active).filter(i => matches(i.equipement, i.description) && (page === 'history' || !level || i.niveauAttention === level));
  if (initializing) return <div className="loading-screen" role="status">Connexion au réseau…</div>;
  if (!session) return <Login initialError={error} onLogin={u => { setError(''); setSession(u); }} />;
  return <div className="app-shell">
    <aside className="sidebar"><Brand />
      <div className="workspace-switcher"><div className="workspace-icon"><Icon name="grid" size={17} /></div><div><strong>Réseau de transport</strong><small>Supervision des équipements</small></div></div>
      <nav className="main-nav" aria-label="Navigation principale"><p className="nav-label">VUE D’ENSEMBLE</p>{pages.map(p => <button key={p.id} className={`nav-item ${page === p.id ? 'active' : ''}`} onClick={() => { setPage(p.id); setSearch(''); setLevel(''); }}><Icon name={p.icon} size={18} /><span>{p.label}</span>{p.id === 'equipment' && <em>{equipment.length}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{session.prenom.slice(0, 2).toUpperCase()}</div><div><strong>{session.prenom}</strong><small>{manager ? 'Responsable d’exploitation' : 'Agent de terrain'}</small></div></div></div>
    </aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumb"><span>Réseau</span><Icon name="chevron" size={14} /><strong>{pages.find(p => p.id === page)?.label}</strong></div>
      <div className="session-greeting">Bonjour {session.prenom} ({manager ? 'Responsable' : 'Agent'}) | <button className="text-button" onClick={async () => { try { await logout(); setSession(null); setLoaded(false); setSelected(null); setSelectedEquipment(null); setCreating(false); } catch (err) { setError(message(err)); } }}>Déconnectez-vous</button></div></header>
      <div className="page-content"><div className="page-heading"><div><p className="eyebrow">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1>{pages.find(p => p.id === page)?.label}</h1><p className="page-description">{page === 'dashboard' ? 'Une vision claire des incidents et des interventions du réseau.' : page === 'equipment' ? 'Consultez les équipements et leur historique par station.' : page === 'history' ? 'Interventions résolues, de la plus récente à la plus ancienne.' : 'Contacts et évaluations des partenaires du réseau.'}</p></div><button className="primary-button" disabled={!loaded} onClick={() => setCreating(true)}><Icon name="plus" size={17} /> Déclarer un incident</button></div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="refresh-row"><span role="status">{loading ? 'Actualisation…' : updated ? `Actualisé à ${updated.toLocaleTimeString('fr-FR')}` : 'Données non chargées'}</span><button className="text-button" disabled={loading} onClick={() => void refresh().catch(() => {})}>Actualiser</button></div>
      {page === 'dashboard' && <><section className="stats-grid"><Stat label="Incidents actifs" value={active.length} icon="bell" /><Stat label="En attente d’affectation" value={active.filter(i => !i.prestataire).length} icon="clock" /><Stat label="Incidents critiques" value={active.filter(i => i.niveauAttention === 'ROUGE').length} icon="bell" /><Stat label="Équipements opérationnels" value={`${equipment.length ? Math.round(equipment.filter(e => isOperational(e)).length / equipment.length * 100) : 0} %`} icon="tools" /></section></>}
      {page !== 'providers' && <div className="filters"><label>Rechercher<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Description, équipement, station…" /></label><label>Station<select value={station} onChange={e => setStation(e.target.value)}><option value="">Toutes les stations</option>{stations.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}</select></label>{page === 'dashboard' && <label>Niveau d’attention<select value={level} onChange={e => setLevel(e.target.value)}><option value="">Tous les niveaux</option>{Object.entries(levels).filter(([key]) => key !== 'RESOLU').map(([key, [, text]]) => <option key={key} value={key}>{text}</option>)}</select></label>}<button className="text-button" onClick={() => { setSearch(''); setStation(''); setLevel(''); }}>Réinitialiser</button></div>}
      {(page === 'dashboard' || page === 'history') && <section className="panel incident-panel"><div className="panel-title padded"><h2>{page === 'dashboard' ? 'Incidents actifs' : 'Incidents résolus'} <span className="count-pill">{visible.length}</span></h2></div><IncidentList incidents={visible} onSelect={setSelected} empty={loading ? 'Chargement…' : 'Aucun incident pour ces critères.'} /></section>}
      {page === 'dashboard' && <div className="bottom-grid"><section className="panel station-card"><h2>Incidents actifs par station</h2><p className="page-description">Sélectionnez une station pour filtrer la liste.</p>{stations.map(s => { const count = active.filter(i => i.equipement.station.id === s.id).length; return <button className="station-row station-button" key={s.id} onClick={() => setStation(String(s.id))}><span className="station-meta"><strong>{s.nom}</strong><span>{count} incident{count > 1 ? 's' : ''}</span></span><span className="bar-track"><span className="bar-fill orange" style={{ width: `${count / Math.max(1, active.length) * 100}%` }} /></span></button>; })}</section><section className="panel station-card"><h2>Délais de résolution</h2><p className="page-description">Sur les {history.length} interventions terminées.</p><div className="large-number">{history.length ? duration(Math.round(history.reduce((sum, i) => sum + i.dureeMinutes, 0) / history.length)) : '—'}</div><p>Durée moyenne entre ouverture et résolution</p><div className="legend"><Badge level="VERT" /><Badge level="ORANGE" /><Badge level="ROUGE" /><Badge level="AFFECTE" /></div></section></div>}
      {page === 'equipment' && <div className="panel table-panel"><div className="equipment-table"><div className="equipment-row table-header"><span>ÉQUIPEMENT</span><span>TYPE</span><span>STATION</span><span>ÉTAT</span></div>{equipment.filter(e => matches(e, '')).map(e => <button className="equipment-row" key={e.id} onClick={() => void openEquipment(e)}><span><strong>{e.libelle}</strong><small>{e.reference}</small></span><span>{e.type}</span><span>{e.station.nom}</span><span className={`table-status ${isOperational(e) ? 'success' : 'danger'}`}>{isOperational(e) ? 'Opérationnel' : e.etatFonctionnement.replaceAll('_', ' ')}</span></button>)}</div>{!equipment.filter(e => matches(e, '')).length && <p className="empty-state">Aucun équipement pour ces critères.</p>}</div>}
      {page === 'providers' && <div className="provider-grid">{providers.map(p => <article className="provider-card" key={p.id}><div className="provider-avatar teal">{p.nom.slice(0, 2).toUpperCase()}</div><h2>{p.nom}</h2>{p.sousSurveillance && <p className="surveillance-badge">Sous surveillance</p>}<p><a href={`mailto:${p.contactEmail}`}>{p.contactEmail}</a></p><p><a href={`tel:${p.contactTelephone}`}>{p.contactTelephone}</a></p><div className="provider-divider" /><div className="provider-stats"><div><small>EN COURS</small><strong>{p.interventionsActives}</strong></div><div><small>NOTE MOYENNE</small><strong className="rating">{p.noteMoyenne == null ? 'Non évalué' : `★ ${p.noteMoyenne.toFixed(1)} / 5`}</strong></div></div></article>)}</div>}
      </div>
    </main>
    {creating && <CreateIncident equipment={equipment} onClose={() => setCreating(false)} onCreated={async id => { setCreating(false); await changed(id); }} />}
    {selectedEquipment && !selected && <Dialog title={selectedEquipment.libelle} onClose={() => setSelectedEquipment(null)}><Detail label="Référence" value={selectedEquipment.reference} /><Detail label="Station" value={selectedEquipment.station.nom} /><Detail label="Type" value={selectedEquipment.type} /><h3>Incidents · du plus récent au plus ancien</h3><IncidentList incidents={equipmentIncidents} onSelect={setSelected} empty="Aucun incident sur cet équipement." /></Dialog>}
    {selected && <IncidentDetails key={selected.id} incident={selected} providers={providers} manager={manager} onClose={() => setSelected(null)} onChanged={changed} />}
  </div>;
}
function Login({ onLogin, initialError }: { onLogin: (s: Session) => void; initialError: string }) {
  const [error, setError] = useState(initialError), [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget); setError(''); setPending(true);
    try { await login(String(data.get('login')), String(data.get('password'))); onLogin(await api<Session>('/session')); }
    catch (err) { setError(message(err)); } finally { setPending(false); }
  }
  return <main className="login-screen"><div className="login-intro"><p className="eyebrow">SUPERVISION DU RÉSEAU</p><h1>Votre réseau.<br />Sous contrôle<span>.</span></h1><p>Des équipements suivis.<br />Des interventions coordonnées.<br />Un réseau qui avance.</p><svg className="network-art" viewBox="0 0 460 210" fill="none" aria-hidden="true"><path d="M-20 174H104C146 174 146 105 190 105H290C334 105 334 38 374 38H480" stroke="currentColor" strokeWidth="12"/><path d="M-20 118H70C112 118 112 49 154 49H240C288 49 288 174 332 174H480" stroke="currentColor" strokeOpacity=".24" strokeWidth="12"/>{[[68,174],[214,105],[394,38]].map(([cx,cy]) => <g key={cx}><circle cx={cx} cy={cy} r="15" fill="#11262e" stroke="currentColor" strokeWidth="4"/><circle cx={cx} cy={cy} r="5" fill="currentColor"/></g>)}</svg></div><form className="login-card" onSubmit={submit}><Brand /><h2>Connexion</h2><p className="page-description">Accédez à votre espace de supervision.</p>{error && <div className="error-banner" role="alert">{error}</div>}<label>Identifiant<input name="login" autoComplete="username" required autoFocus /></label><label>Mot de passe<input name="password" type="password" autoComplete="current-password" required /></label><button className="primary-button full" disabled={pending}>{pending ? 'Connexion…' : 'Se connecter'}<Icon name="arrow" size={18} /></button></form></main>;
}
function Stat({ label, value, icon }: { label: string; value: number | string; icon: string }) { return <div className="stat-card"><div className="stat-icon blue"><Icon name={icon} size={18} /></div><p>{label}</p><div className="stat-value">{value}</div></div>; }
function IncidentList({ incidents, onSelect, empty }: { incidents: Incident[]; onSelect: (i: Incident) => void; empty: string }) {
  return <>{incidents.map(i => <button className="incident-row" key={i.id} onClick={() => onSelect(i)}><span className={`priority-bar ${levels[i.niveauAttention]?.[0]}`} /><span className="incident-main"><span className="incident-title"><strong>{i.description}</strong><span>INC-{i.id}</span></span><span className="incident-location">{i.equipement.station.nom} · {i.equipement.reference} · {i.equipement.libelle}</span></span><span className="incident-duration"><small>{i.dateResolution ? 'RÉSOLU LE' : 'OUVERT DEPUIS'}</small><strong>{i.dateResolution ? date(i.dateResolution) : duration(i.dureeMinutes)}</strong></span><span className="incident-state"><Badge level={i.niveauAttention} />{i.prestataire && <small>{i.prestataire.nom}</small>}{i.evaluation && <small>★ {i.evaluation.note} / 5</small>}</span><Icon name="chevron" size={16} /></button>)}{!incidents.length && <p className="empty-state">{empty}</p>}</>;
}
function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; ref.current?.focus();
    return () => { document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <div className="drawer-backdrop" onClick={onClose}><aside ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={e => e.stopPropagation()} onKeyDown={e => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Tab') {
      const elements = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, a[href]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }}><div className="drawer-top"><h2>{title}</h2><button className="close-button" aria-label="Fermer" onClick={onClose}>×</button></div>{children}</aside></div>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>; }
function CreateIncident({ equipment, onClose, onCreated }: { equipment: Equipment[]; onClose: () => void; onCreated: (id: number) => Promise<void> }) {
  const [error, setError] = useState(''), [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setPending(true); const data = new FormData(event.currentTarget);
    try { const incident = await api<Incident>('/incidents', 'POST', { equipementId: Number(data.get('equipment')), description: data.get('description') }); await onCreated(incident.id); }
    catch (err) { setError(message(err)); } finally { setPending(false); }
  }
  return <Dialog title="Déclarer un incident" onClose={onClose}><p className="page-description">Décrivez le problème rencontré. L’incident sera enregistré sans prestataire.</p><form onSubmit={submit}>{error && <div className="error-banner" role="alert">{error}</div>}<label>Équipement<select name="equipment" required defaultValue=""><option value="" disabled>Choisir un équipement</option>{equipment.map(e => <option key={e.id} value={e.id}>{e.station.nom} · {e.reference} · {e.libelle}</option>)}</select></label><label>Description<textarea name="description" required maxLength={5000} rows={6} /></label><button className="primary-button full" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer l’incident'}</button></form></Dialog>;
}
function IncidentDetails({ incident: i, providers, manager, onClose, onChanged }: { incident: Incident; providers: Provider[]; manager: boolean; onClose: () => void; onChanged: (id: number) => Promise<void> }) {
  const [description, setDescription] = useState(i.description), [provider, setProvider] = useState(i.prestataire?.id.toString() ?? '');
  const [error, setError] = useState(''), [pending, setPending] = useState(false), [confirm, setConfirm] = useState(false);
  const [surveillanceRequired, setSurveillanceRequired] = useState(false);
  const [surveillanceConfirmed, setSurveillanceConfirmed] = useState(false);
  useEffect(() => { setDescription(i.description); setProvider(i.prestataire?.id.toString() ?? ''); }, [i.description, i.prestataire?.id]);
  useEffect(() => { setSurveillanceRequired(false); setSurveillanceConfirmed(false); }, [i.id, provider]);
  async function assignProvider(e: FormEvent) {
    e.preventDefault(); setPending(true); setError('');
    try {
      await api(`/incidents/${i.id}/prestataire`, 'PUT', {
        prestataireId: Number(provider), confirmationSurveillance: surveillanceRequired && surveillanceConfirmed,
      });
      setSurveillanceRequired(false); setSurveillanceConfirmed(false);
      await onChanged(i.id);
    } catch (err) {
      setError(message(err));
      if (err instanceof ApiError && err.code === 'CONFIRMATION_SURVEILLANCE_REQUISE') {
        setSurveillanceRequired(true); setSurveillanceConfirmed(false);
      }
    } finally { setPending(false); }
  }
  async function action(path: string, method: string, body?: unknown) {
    setPending(true); setError('');
    try { await api(`/incidents/${i.id}${path}`, method, body); await onChanged(i.id); setConfirm(false); }
    catch (err) { setError(message(err)); } finally { setPending(false); }
  }
  const resolved = i.statut === 'RESOLU';
  return <Dialog title={`Incident INC-${i.id}`} onClose={onClose}><div className="drawer-heading"><Badge level={i.niveauAttention} /><h2>{i.description}</h2></div>{error && <div className="error-banner" role="alert">{error}</div>}<Detail label="Station" value={i.equipement.station.nom} /><Detail label="Équipement" value={`${i.equipement.reference} · ${i.equipement.libelle}`} /><Detail label="Ouvert le" value={date(i.dateOuverture)} /><Detail label="Durée" value={duration(i.dureeMinutes)} /><Detail label="Prestataire" value={i.prestataire ? `${i.prestataire.nom}${i.prestataire.sousSurveillance ? ' (sous surveillance)' : ''}` : 'Non affecté'} />{i.dateResolution && <Detail label="Résolu le" value={date(i.dateResolution)} />}
    {manager && !resolved && <><form onSubmit={e => { e.preventDefault(); void action('', 'PATCH', { description }); }}><label>Description<textarea required maxLength={5000} rows={4} value={description} onChange={e => setDescription(e.target.value)} /></label><button className="secondary-button full" disabled={pending || description === i.description}>Enregistrer la description</button></form><form onSubmit={assignProvider}><label>Prestataire<select required disabled={pending} value={provider} onChange={e => { setProvider(e.target.value); setError(''); }}><option value="" disabled>Choisir un prestataire</option>{providers.map(p => <option key={p.id} value={p.id}>{p.nom}{p.sousSurveillance ? ' (sous surveillance)' : ''}{p.noteMoyenne != null ? ` · ★ ${p.noteMoyenne.toFixed(1)}` : ''}</option>)}</select></label>{surveillanceRequired && <div className="surveillance-confirm"><p>Ce prestataire est sous surveillance. Confirmez cette affectation pour continuer.</p><label className="confirmation-checkbox"><input type="checkbox" checked={surveillanceConfirmed} disabled={pending} onChange={e => setSurveillanceConfirmed(e.target.checked)} />Je confirme l’affectation à ce prestataire sous surveillance.</label></div>}<button className="primary-button full" disabled={pending || (surveillanceRequired && !surveillanceConfirmed)}>{surveillanceRequired ? 'Confirmer l’affectation' : `${i.prestataire ? 'Réaffecter' : 'Affecter'} le prestataire`}</button></form>{confirm ? <div className="resolution-confirm"><p>Confirmer la résolution ? Cette action clôture l’incident.</p><button className="primary-button full" disabled={pending} onClick={() => void action('/resolution', 'PUT')}>Confirmer la résolution</button><button className="text-button" disabled={pending} onClick={() => setConfirm(false)}>Annuler</button></div> : <button className="secondary-button full" disabled={pending} onClick={() => setConfirm(true)}>Déclarer comme résolu</button>}</>}
    {i.evaluation && <section className="evaluation-card"><h3>Évaluation de l’intervention</h3><p className="rating">★ {i.evaluation.note} / 5</p><p>{i.evaluation.commentaire || 'Aucun commentaire.'}</p><small>{date(i.evaluation.dateEvaluation)}</small></section>}
    {manager && resolved && i.prestataire && !i.evaluation && <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void action('/evaluation', 'POST', { note: Number(data.get('note')), commentaire: data.get('comment') }); }}><h3>Évaluer l’intervention</h3><label>Note<select name="note" required defaultValue=""><option value="" disabled>Choisir une note</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label><label>Commentaire (facultatif)<textarea name="comment" rows={3} maxLength={5000} /></label><button className="primary-button full" disabled={pending}>Enregistrer l’évaluation</button></form>}
    {!manager && <p className="page-description">Consultation en lecture seule. Les interventions sont gérées par le responsable d’exploitation.</p>}
  </Dialog>;
}
export default App;
