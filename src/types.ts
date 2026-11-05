export type Session = { login: string; prenom: string; profil: 'RESPONSABLE' | 'AGENT' };
export type Station = { id: number; nom: string };
export type Equipment = { id: number; reference: string; libelle: string; type: string; etatFonctionnement: string; station: Station };
export type Provider = { id: number; nom: string; contactEmail: string; contactTelephone: string; noteMoyenne: number | null; interventionsActives: number; moyenneDernieresEvaluations: number | null; sousSurveillance: boolean };
export type Incident = { id: number; description: string; equipement: Equipment; statut: string; dateOuverture: string; dateResolution: string | null;
  dureeMinutes: number; niveauAttention: string; prestataire: Provider | null; evaluation: { note: number; commentaire: string | null; dateEvaluation: string } | null };
