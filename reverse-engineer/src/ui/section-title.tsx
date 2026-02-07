export function SectionTitle(props: { title: string }) {
  return (
    <div className="text-xxs font-medium text-secondary-foreground">
      {props.title}
    </div>
  );
}

export function SectionSubtitle(props: { text: string }) {
  return <div className="text-[9px] opacity-70 mb-1">{props.text}</div>;
}
