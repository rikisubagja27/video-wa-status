import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({compact = false}) => {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <svg
        width={compact ? 28 : 34}
        height={compact ? 28 : 34}
        viewBox="0 0 512 512"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="512" height="512" rx="112" fill="#101820" />
        <rect x="20" y="20" width="472" height="472" rx="96" stroke="#1E293B" strokeWidth="12" />
        <rect
          x="88"
          y="132"
          width="336"
          height="248"
          rx="36"
          fill="#16212C"
          stroke="#10B981"
          strokeWidth="16"
        />
        <path d="M220 202L308 256L220 310V202Z" fill="#10B981" />
        <rect x="308" y="100" width="132" height="64" rx="18" fill="#10B981" />
        <text
          x="374"
          y="144"
          textAnchor="middle"
          fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
          fontWeight="800"
          fontSize="36"
          fill="#06120E"
          letterSpacing="2"
        >
          HD
        </text>
      </svg>
      <span className="font-display font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 text-base sm:text-lg">
        WA Status HD Pro
      </span>
    </div>
  );
};
