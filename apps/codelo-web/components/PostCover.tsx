import Image from "next/image";
import type { CmsImage } from "@/lib/cms";
import { cn } from "@/lib/utils";

type Props = {
  image: CmsImage;
  alt?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /**
   * Best Strapi-generated format to request given the rendered context.
   * "large" (~1000px) for hero, "medium" (~750px) for featured cards,
   * "small" (~500px) for grid cards, "thumbnail" (~245px) for chips.
   */
  format?: "thumbnail" | "small" | "medium" | "large" | "original";
};

function pickUrl(image: CmsImage, format: Props["format"]): string {
  if (!format || format === "original") return image.url;
  return image.formats?.[format] ?? image.url;
}

export function PostCover({ image, alt, className, sizes, priority, format = "medium" }: Props) {
  const src = pickUrl(image, format);
  const width = image.width ?? 1536;
  const height = image.height ?? 1024;
  const altText = alt ?? image.alt ?? "";

  return (
    <Image
      src={src}
      alt={altText}
      width={width}
      height={height}
      sizes={sizes ?? "(min-width: 1024px) 50vw, 100vw"}
      priority={priority}
      quality={70}
      className={cn("object-cover", className)}
      // Optimize through Next: Strapi serves big PNGs with no caching
      // (cache-control: max-age=0), so let Next re-encode to AVIF/WebP at the
      // displayed size and cache the result. The `/cms/...` source is
      // same-origin (proxied), so no remotePatterns entry is needed.
    />
  );
}
