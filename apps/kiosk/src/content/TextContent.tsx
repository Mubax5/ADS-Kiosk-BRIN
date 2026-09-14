import ReactMarkdown from "react-markdown";

export function TextContent({ title, body }: { title: string; body: string }) {
  return (
    <article className="kiosk-document">
      <h1>{title}</h1>
      <div className="kiosk-prose"><ReactMarkdown skipHtml>{body}</ReactMarkdown></div>
    </article>
  );
}
