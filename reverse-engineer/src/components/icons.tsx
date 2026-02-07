import type React from "react";

export function ScanTopleft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <path d="M3 18V10.5C3 8.51088 3.79018 6.60322 5.1967 5.1967C6.60322 3.79018 8.51088 3 10.5 3H18" />
    </svg>
  );
}

export function ScanTopRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <path d="M6 3H13.5C15.4891 3 17.3968 3.79018 18.8033 5.1967C20.2098 6.60322 21 8.51088 21 10.5V18" />
    </svg>
  );
}

export function ScanBottomRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <path d="M21 6V13.5C21 15.4891 20.2098 17.3968 18.8033 18.8033C17.3968 20.2098 15.4891 21 13.5 21H6" />
    </svg>
  );
}

export function ScanBottomLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <path d="M18 21H10.5C8.51088 21 6.60322 20.2098 5.1967 18.8033C3.79018 17.3968 3 15.4891 3 13.5V6" />
    </svg>
  );
}

export function BoxLineTop(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <path d="M14 21H15" />
      <path d="M21 14V15" />
      <path d="M21 19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21" />
      <path d="M21 9V10" />
      <path d="M3 14V15" />
      <path d="M3 5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5" />
      <path d="M3 9V10" />
      <path d="M5 21C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19" />
      <path d="M9 21H10" />
    </svg>
  );
}

export function BoxLineRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <path d="M3 14L3 15" />
      <path d="M10 21L9 21" />
      <path d="M5 21C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19" />
      <path d="M15 21L14 21" />
      <path d="M10 3L9 3" />
      <path d="M19 3C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5L21 19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21" />
      <path d="M15 3L14 3" />
      <path d="M3 5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3" />
      <path d="M3 9L3 10" />
    </svg>
  );
}

export function BoxLineBottom(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <path d="M10 3L9 3" />
      <path d="M3 10L3 9" />
      <path d="M3 5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3" />
      <path d="M3 15L3 14" />
      <path d="M21 10L21 9" />
      <path d="M21 19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21L5 21C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19" />
      <path d="M21 15L21 14" />
      <path d="M19 3C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5" />
      <path d="M15 3L14 3" />
    </svg>
  );
}

export function BoxLineLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <path d="M21 10L21 9" />
      <path d="M14 3L15 3" />
      <path d="M19 3C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5" />
      <path d="M9 3L10 3" />
      <path d="M14 21L15 21" />
      <path d="M5 21C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19L3 5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3" />
      <path d="M9 21L10 21" />
      <path d="M21 19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21" />
      <path d="M21 15L21 14" />
    </svg>
  );
}

export function TextLineHorizontal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <path d="M2 21L2 3" />
      <path d="M22 21L22 3" />
      <path d="M6 19.1998L12 4.7998L18 19.1998" />
      <path d="M8.00003 14.3984H16" />
    </svg>
  );
}

export function TextLineVertical(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <path d="M21 2L3 2" />
      <path d="M21 22L3 22" />
      <path d="M6 19.1998L12 4.7998L18 19.1998" />
      <path d="M8.00003 14.3984H16" />
    </svg>
  );
}

export function TextVerticalAlignCenter(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <path d="M12 22V16" />
      <path d="M12 8V2" />
      <path d="M22 12H2" />
      <path d="M15 19L12 16L9 19" />
      <path d="M15 5L12 8L9 5" />
    </svg>
  );
}

export function VariableStringIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      {...props}
    >
      <path d="M2.66675 4.66675V2.66675H13.3334V4.66675" />
      <path d="M6 13.3333H10" />
      <path d="M8 2.66675V13.3334" />
    </svg>
  );
}

export function VariableNumberIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      {...props}
    >
      <path d="M2 11H13" />
      <path d="M3 5H14" />
      <path d="M12 2L10 14" />
      <path d="M6 2L4 14" />
    </svg>
  );
}

export function VariableColorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      {...props}
    >
      <path d="M8 2L11.6 6.8C12.9436 8.59154 12.7654 11.0985 11.1819 12.682C9.42461 14.4393 6.57539 14.4393 4.81805 12.682C3.23456 11.0985 3.0564 8.59154 4.40004 6.8L8 2Z" />
    </svg>
  );
}

export function DuplicateIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      {...props}
    >
      <rect x="2" y="6" width="8" height="8" />
      <path d="M6 4V2H14V10H12" />
    </svg>
  );
}

export function MoveIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      {...props}
    >
      <path d="M13 8L3 8" />
      <path d="M9.49995 11.5L13 8L9.5 4.5" />
    </svg>
  );
}

export function RenameIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      {...props}
    >
      <path d="M5 14H2V11L12 1L15 4L5 14Z" />
      <path d="M13 6L10 3" />
    </svg>
  );
}

export function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      {...props}
    >
      <path d="M2 5H3.33333H14" />
      <path d="M4.5 5L4.86073 2.8356C4.9411 2.35341 5.35829 2 5.84713 2H10.1529C10.6417 2 11.0589 2.35341 11.1393 2.8356L11.5 5" />
      <path d="M3.5 5L4.40116 13.1104C4.45743 13.6169 4.88549 14 5.39504 14H10.605C11.1145 14 11.5426 13.6169 11.5988 13.1104L12.5 5" />
    </svg>
  );
}

// Toolbar icons
interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

const createIcon = (paths: React.ReactNode): React.FC<IconProps> => {
  return ({ className, ...props }) => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
      role="presentation"
    >
      {paths}
    </svg>
  );
};

export const IconMove = createIcon(
  <path
    d="M2.5 2.5L6.5 14.5L8.5 8.5L14.5 6.5L2.5 2.5Z"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
);

export const IconRectangle = createIcon(
  <rect
    x="2"
    y="2"
    width="12"
    height="12"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
);

export const IconText = createIcon(
  <>
    <path
      d="M2.66667 4.66675V2.66675H13.3333V4.66675"
      stroke="currentColor"
      strokeLinejoin="round"
    />
    <path d="M6 13.3333H10" stroke="currentColor" strokeLinejoin="round" />
    <path d="M8 2.66675V13.3334" stroke="currentColor" strokeLinejoin="round" />
  </>,
);

export const IconFrame = createIcon(
  <>
    <path d="M4 2L4 14" stroke="currentColor" strokeLinejoin="round" />
    <path d="M12 2L12 14" stroke="currentColor" strokeLinejoin="round" />
    <path d="M14 4L2 4" stroke="currentColor" strokeLinejoin="round" />
    <path d="M14 12L2 12" stroke="currentColor" strokeLinejoin="round" />
  </>,
);

export const IconStickyNote = createIcon(
  <>
    <path
      d="M10 14L10 10L14 10"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 2H14V10L10 14H2V2Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M11 5H4" stroke="currentColor" strokeLinejoin="round" />
    <path d="M8 8H4" stroke="currentColor" strokeLinejoin="round" />
  </>,
);

export const IconHand = createIcon(
  <path
    d="M10.8022 2.5H10.905C11.493 2.5 11.9541 3.00492 11.9009 3.59054L11.5 8L12.5082 5.98355C12.7694 5.46129 13.4291 5.28608 13.915 5.60997C14.264 5.84267 14.4241 6.27328 14.3118 6.67749L13.1625 10.8149C12.4755 13.2883 10.2235 15 7.6564 15C5.42741 15 3.40183 13.704 2.46776 11.6801L1.32333 9.20055C1.12906 8.77963 1.21777 8.28223 1.54558 7.95442C2.03934 7.46066 2.86137 7.54206 3.24871 8.12306L4.5 10L3.65096 3.63216C3.57102 3.03268 4.03739 2.5 4.64218 2.5H4.69783C5.16653 2.5 5.57234 2.82553 5.67402 3.28307L6.5 7L6.92359 1.91695C6.96678 1.39866 7.40004 1 7.92013 1H8C8.55228 1 9 1.44772 9 2V7L9.82598 3.28307C9.92766 2.82553 10.3335 2.5 10.8022 2.5Z"
    stroke="currentColor"
    strokeLinejoin="round"
  />,
);

export const IconVariables = createIcon(
  <>
    <path
      d="M8 1L15 8L8 15L1 8L8 1Z"
      stroke="currentColor"
      strokeLinejoin="round"
    />
    <path
      d="M5 5L11 11"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
    />
    <path
      d="M11 5L5 11"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
    />
  </>,
);

export const IconDesignKits = createIcon(
  <>
    <path
      d="M6.99989 5.48539L9.48529 3L13.0208 6.53553L6.3033 13.253C5.32699 14.2294 3.74408 14.2294 2.76777 13.253C2.15556 12.6408 2.00008 12 2.00008 11"
      stroke="currentColor"
      strokeLinejoin="round"
    />
    <path
      d="M2 11.5C2 12.8807 3.11929 14 4.5 14L14 14V9H10.4851"
      stroke="currentColor"
      strokeLinejoin="round"
    />
    <path
      d="M2 2L7 2L7 11.5C7 12.8807 5.88071 14 4.5 14C3.11929 14 2 12.8807 2 11.5L2 2Z"
      stroke="currentColor"
      strokeLinejoin="round"
    />
    <path d="M4.5 12L4.5 11" stroke="currentColor" strokeLinejoin="round" />
  </>,
);

export const IconKeyboard = createIcon(
  <>
    <path d="M1 3H15V13H1V3Z" stroke="currentColor" strokeLinejoin="round" />
    <path d="M11.5 5.5H10.5" stroke="currentColor" />
    <path d="M10 8H9" stroke="currentColor" />
    <path d="M13 8H12" stroke="currentColor" />
    <path d="M8.5 5.5H7.5" stroke="currentColor" />
    <path d="M7 8H6" stroke="currentColor" />
    <path d="M4 8H3" stroke="currentColor" />
    <path d="M5.5 5.5H4.5" stroke="currentColor" />
    <path d="M11 10.5H5" stroke="currentColor" />
  </>,
);

export const IconEllipse = createIcon(
  <rect
    x="2"
    y="2"
    width="12"
    height="12"
    rx="6"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
);

export const IconImage = createIcon(
  <>
    <path d="M4 14L11 6L14 9" stroke="currentColor" />
    <circle
      cx="5.5"
      cy="6.5"
      r="1.5"
      stroke="currentColor"
      strokeLinejoin="round"
    />
    <rect
      x="2"
      y="2"
      width="12"
      height="12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>,
);

export const IconIconFont = createIcon(
  <path
    d="M6.1857 2.26318C6.80892 0.578942 9.19108 0.578941 9.8143 2.26317L10.565 4.29202C10.761 4.82153 11.1785 5.23902 11.708 5.43496L13.7368 6.1857C15.4211 6.80892 15.4211 9.19108 13.7368 9.8143L11.708 10.565C11.1785 10.761 10.761 11.1785 10.565 11.708L9.8143 13.7368C9.19108 15.4211 6.80892 15.4211 6.1857 13.7368L5.43496 11.708C5.23902 11.1785 4.82153 10.761 4.29202 10.565L2.26318 9.8143C0.578942 9.19108 0.578941 6.80892 2.26317 6.1857L4.29202 5.43496C4.82153 5.23902 5.23902 4.82153 5.43496 4.29202L6.1857 2.26318Z"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
);

export const IconSettings = createIcon(
  <>
    <path d="M5 3H2" stroke="currentColor" stroke-linejoin="round" />
    <path d="M9 8H2" stroke="currentColor" stroke-linejoin="round" />
    <path d="M7 13H2" stroke="currentColor" stroke-linejoin="round" />
    <path d="M5 5V1" stroke="currentColor" stroke-linejoin="round" />
    <path d="M11 10V6" stroke="currentColor" stroke-linejoin="round" />
    <path d="M7 15V11" stroke="currentColor" stroke-linejoin="round" />
    <path d="M14 3L7 3" stroke="currentColor" stroke-linejoin="round" />
    <path d="M14 8L11 8" stroke="currentColor" stroke-linejoin="round" />
    <path d="M14 13L9 13" stroke="currentColor" stroke-linejoin="round" />
  </>,
);

export const IconResize = createIcon(
  <>
    <path
      d="M10 10L14 14"
      stroke="currentColor"
      stroke-width="0.75"
      stroke-linejoin="round"
    />
    <path
      d="M10 6L14 2"
      stroke="currentColor"
      stroke-width="0.75"
      stroke-linejoin="round"
    />
    <path
      d="M13.9974 10.667V14.0003H10.6641"
      stroke="currentColor"
      stroke-width="0.75"
    />
    <path
      d="M13.9974 5.33333V2H10.6641"
      stroke="currentColor"
      stroke-width="0.75"
    />
    <path
      d="M2 10.667V14.0003H5.33333"
      stroke="currentColor"
      stroke-width="0.75"
    />
    <path
      d="M2 14L6 10"
      stroke="currentColor"
      stroke-width="0.75"
      stroke-linejoin="round"
    />
    <path d="M2 5.33333V2H5.33333" stroke="currentColor" stroke-width="0.75" />
    <path
      d="M6 6L2 2"
      stroke="currentColor"
      stroke-width="0.75"
      stroke-linejoin="round"
    />
  </>,
);

export const ColorFillIcon = createIcon(
  <>
    <rect
      x="2"
      y="2"
      width="12"
      height="12"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <rect x="4" y="4" width="8" height="8" fill="currentColor" />
  </>,
);

export const GradientFillIcon = createIcon(
  <>
    <rect
      x="2"
      y="2"
      width="12"
      height="12"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path d="M4 9L9 4" stroke="currentColor" />
    <path d="M7 12L12 7" stroke="currentColor" />
    <path d="M10 12L12 10" stroke="currentColor" />
    <path d="M4 6L6 4" stroke="currentColor" />
    <path d="M4 12L12 4" stroke="currentColor" />
  </>,
);

export const ImageFillIcon = createIcon(
  <>
    <path d="M4 14L11 6L14 9" stroke="currentColor" />
    <circle
      cx="5.5"
      cy="6.5"
      r="1.5"
      stroke="currentColor"
      stroke-linejoin="round"
    />
    <rect
      x="2"
      y="2"
      width="12"
      height="12"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </>,
);

export const IconFigma: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 18 26"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="presentation"
    {...props}
  >
    <path
      d="M1 5C1 2.79086 2.79086 1 5 1H9V9H5C2.79086 9 1 7.20914 1 5V5Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M17 5C17 2.79086 15.2091 1 13 1H9V9H13C15.2091 9 17 7.20914 17 5V5Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M17 13C17 10.7909 15.2091 9 13 9V9C10.7909 9 9 10.7909 9 13V13C9 15.2091 10.7909 17 13 17V17C15.2091 17 17 15.2091 17 13V13Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M1 13C1 10.7909 2.79086 9 5 9H9V17H5C2.79086 17 1 15.2091 1 13V13Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M1 21C1 18.7909 2.79086 17 5 17H9V21C9 23.2091 7.20914 25 5 25V25C2.79086 25 1 23.2091 1 21V21Z"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

export function BezierCurveSymmetric(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      {...props}
    >
      <path d="M18.7989 10.6126C19.58 11.3936 20.8463 11.3936 21.6273 10.6126C22.4084 9.83153 22.4084 8.5652 21.6273 7.78415C20.8463 7.0031 19.58 7.0031 18.7989 7.78415C18.0179 8.5652 18.0179 9.83153 18.7989 10.6126Z" />
      <path d="M18 9.19835L5.99998 9.19838" />
      <path d="M18.0001 17.5C18.0001 17.5 17.0001 9.50006 12 9.50004C6.99995 9.50003 6.00003 17.5 6.00003 17.5" />
      <path d="M2.41416 10.6126C3.1952 11.3936 4.46153 11.3936 5.24258 10.6126C6.02363 9.83153 6.02363 8.5652 5.24258 7.78415C4.46153 7.0031 3.1952 7.0031 2.41416 7.78415C1.63311 8.5652 1.63311 9.83153 2.41416 10.6126Z" />
    </svg>
  );
}

export function BezierCurveAsymmetric(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1}
      {...props}
    >
      <path d="M17.4142 6.24264C18.1952 7.02369 19.4615 7.02369 20.2426 6.24264C21.0236 5.46159 21.0236 4.19526 20.2426 3.41421C19.4615 2.63316 18.1952 2.63316 17.4142 3.41421C16.6331 4.19526 16.6331 5.46159 17.4142 6.24264Z" />
      <path d="M17 6L11.9999 9.19843L5.99992 9.19844" />
      <path d="M18.0001 17.5C18.0001 17.5 17.0001 9.50006 12 9.50004C6.99995 9.50003 6.00003 17.5 6.00003 17.5" />
      <path d="M2.41416 10.6126C3.1952 11.3936 4.46153 11.3936 5.24258 10.6126C6.02363 9.83153 6.02363 8.5652 5.24258 7.78415C4.46153 7.0031 3.1952 7.0031 2.41416 7.78415C1.63311 8.5652 1.63311 9.83153 2.41416 10.6126Z" />
    </svg>
  );
}
