/** Marks a paid article (Handelsblatt H+). The full text needs the subscription. */
export default function PremiumBadge() {
  return (
    <span
      className="eyebrow flex-shrink-0 rounded bg-well px-1.5 py-0.5 !text-[10px] font-semibold text-ink-soft"
      title="Paid article (Handelsblatt H+)"
    >
      H+
    </span>
  )
}
