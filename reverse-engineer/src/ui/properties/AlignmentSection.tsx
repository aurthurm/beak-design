import * as React from "react";
import { Button } from "../../components/button";
import AlignHorLeft from "../icons/align-hor-left.svg";
import AlignHorMiddle from "../icons/align-hor-middle.svg";
import AlignHorRight from "../icons/align-hor-right.svg";
import AlignVertBottom from "../icons/align-vert-bottom.svg";
import AlignVertMiddle from "../icons/align-vert-middle.svg";
import AlignVertTop from "../icons/align-vert-top.svg";
import { SectionTitle } from "../section-title";
import { Section } from "../section";

export type AlignType =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom";

interface AlignmentControlsProps {
  disabled: boolean;
  onAlignClick: (align: AlignType) => void;
}

export const AlignmentControls = React.memo(function AlignmentControls({
  disabled,
  onAlignClick,
}: AlignmentControlsProps): React.ReactElement {
  return (
    <Section>
      <SectionTitle title="Alignment" />
      <div
        className="flex gap-1 justify-between"
        style={{
          opacity: disabled ? 0.4 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
      >
        {/* Vertical alignment buttons */}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onAlignClick("left")}
          title="Align Left"
        >
          <img src={AlignHorLeft} alt="Align Left" className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onAlignClick("center")}
          title="Align Center"
        >
          <img src={AlignHorMiddle} alt="Align Center" className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onAlignClick("right")}
          title="Align Right"
        >
          <img src={AlignHorRight} alt="Align Right" className="h-4 w-4" />
        </Button>

        {/* Horizontal alignment buttons */}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onAlignClick("top")}
          title="Align Top"
        >
          <img src={AlignVertTop} alt="Align Top" className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onAlignClick("middle")}
          title="Align Middle"
        >
          <img src={AlignVertMiddle} alt="Align Middle" className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onAlignClick("bottom")}
          title="Align Bottom"
        >
          <img src={AlignVertBottom} alt="Align Bottom" className="h-4 w-4" />
        </Button>
      </div>
    </Section>
  );
});

export default AlignmentControls;
