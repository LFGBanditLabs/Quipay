import { Helmet } from "react-helmet";
import { SITE_NAME, toAbsoluteUrl } from "../../seo/siteMeta";

export interface SeoHelmetProps {
  title: string;
  description: string;
  path: string;
  imagePath: string;
  robots?: string;
  type?: "website" | "article";
}

export function SeoHelmet({
  title,
  description,
  path,
  imagePath,
  robots = "index,follow",
  type = "website",
}: SeoHelmetProps) {
  const fullTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`;
  const pageUrl = toAbsoluteUrl(path);
  const imageUrl = toAbsoluteUrl(imagePath);
  const imageType = imagePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/svg+xml";

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <link rel="canonical" href={pageUrl} />

      <meta name="description" content={description} />
      <meta name="robots" content={robots} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:type" content={imageType} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${SITE_NAME} social preview`} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={`${SITE_NAME} social preview`} />
    </Helmet>
  );
}
