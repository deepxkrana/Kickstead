interface ProductImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

/** Product photo with a flat placeholder when there is no image URL. */
export function ProductImage({ src, alt, className = '' }: ProductImageProps) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-neutral text-label-sm text-primary-40 uppercase ${className}`}>
        No image
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={`bg-neutral object-cover ${className}`} />;
}
