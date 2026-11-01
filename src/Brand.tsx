import logo from './assets/trackwise-logo.png';

export default function Brand() {
  return <div className="brand" aria-label="Trackwise">
    <span className="brand-logo"><img src={logo} alt="Trackwise" /></span>
  </div>;
}
