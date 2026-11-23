// A checkbox with a label, inside a paper sheet
export default function CheckRow({ label, hint, checked, onChange }) {
  return (
    <label className="big3-check is-on">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="big3-text">{label}{hint && <small>{hint}</small>}</span>
    </label>
  )
}
