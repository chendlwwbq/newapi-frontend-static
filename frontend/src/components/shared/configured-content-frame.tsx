export function ConfiguredContentFrame(props: { url: string }) {
  return (
    <iframe
      className="custom-home-frame"
      src={props.url}
      sandbox="allow-forms allow-popups"
      referrerPolicy="no-referrer"
      title="eva"
      loading="lazy"
    />
  )
}
