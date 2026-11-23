export default function BackButton({ label, onClick }) {
  return (
    <button type="button" className="back-btn" onClick={onClick}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      {label}
    </button>
  )
}
