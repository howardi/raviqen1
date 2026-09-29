import React from "react";
import ReactMarkdown from "react-markdown";

export default function MarkdownContent({ content, className }) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          h1: ({ node, ...props }) => <h1 className="text-lg font-bold text-[#231F20] mt-4 mb-2" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-base font-bold text-[#231F20] mt-3 mb-2" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-sm font-bold text-[#231F20] mt-2 mb-1" {...props} />,
          h4: ({ node, ...props }) => <h4 className="text-sm font-semibold text-[#231F20] mt-2 mb-1" {...props} />,
          p: ({ node, ...props }) => <p className="text-sm text-slate-600 mb-2 leading-relaxed" {...props} />,
          ul: ({ node, ...props }) => <ul className="text-sm text-slate-600 list-disc pl-5 mb-2 space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="text-sm text-slate-600 list-decimal pl-5 mb-2 space-y-1" {...props} />,
          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-bold text-[#231F20]" {...props} />,
          em: ({ node, ...props }) => <em className="italic text-slate-700" {...props} />,
          table: ({ node, ...props }) => <div className="overflow-x-auto mb-3"><table className="w-full text-xs border border-slate-200" {...props} /></div>,
          thead: ({ node, ...props }) => <thead className="bg-slate-50" {...props} />,
          th: ({ node, ...props }) => <th className="px-2 py-1.5 border border-slate-200 font-semibold text-left text-[#231F20]" {...props} />,
          td: ({ node, ...props }) => <td className="px-2 py-1.5 border border-slate-200 text-slate-600" {...props} />,
          hr: ({ node, ...props }) => <hr className="border-slate-200 my-3" {...props} />,
          blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-slate-300 pl-3 italic text-slate-500 text-sm mb-2" {...props} />,
          code: ({ node, ...props }) => <code className="text-xs font-mono bg-slate-100 px-1 py-0.5 rounded" {...props} />,
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}