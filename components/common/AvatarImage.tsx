import Image from 'next/image'

interface AvatarImageProps {
  src?: string | null;
  size?: number; // px, default 40
  className?: string;
}

export default function AvatarImage({ src, size = 40, className = '' }: AvatarImageProps) {
  const dim = `${size}px`;
  return (
    <div
      style={{ width: dim, height: dim }}
      className={`rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-100 ${className}`}
    >
      {src ? (
        <div className="relative w-full h-full">
          <Image
            src={src}
            alt="avatar"
            fill
            sizes={dim}
            className="object-cover"
          />
        </div>
      ) : (
        <div className="relative w-full h-full">
          <Image
            src="/logo.png"
            alt="default avatar"
            fill
            sizes={dim}
            className="object-contain p-[20%] grayscale opacity-50"
          />
        </div>
      )}
    </div>
  );
}
