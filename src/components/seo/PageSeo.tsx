import { useEffect } from "react";

interface PageSeoProps {
  title: string;
  description: string;
  path: string;
}

const BASE_URL = "https://stengg.it.com";

function setMeta(selector: string, attr: string, value: string, create: () => HTMLElement) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

export function PageSeo({ title, description, path }: PageSeoProps) {
  const url = `${BASE_URL}${path}`;

  useEffect(() => {
    document.title = title;

    const metas: Array<[string, string, string]> = [
      ['meta[name="description"]', "name", "description"],
      ['meta[property="og:title"]', "property", "og:title"],
      ['meta[property="og:description"]', "property", "og:description"],
      ['meta[property="og:url"]', "property", "og:url"],
      ['meta[property="og:type"]', "property", "og:type"],
      ['meta[name="twitter:title"]', "name", "twitter:title"],
      ['meta[name="twitter:description"]', "name", "twitter:description"],
    ];

    const values: Record<string, string> = {
      description,
      "og:title": title,
      "og:description": description,
      "og:url": url,
      "og:type": "website",
      "twitter:title": title,
      "twitter:description": description,
    };

    metas.forEach(([selector, attr, key]) => {
      setMeta(selector, "content", values[key], () => {
        const m = document.createElement("meta");
        m.setAttribute(attr, key);
        return m;
      });
    });

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);
  }, [title, description, url]);

  return null;
}