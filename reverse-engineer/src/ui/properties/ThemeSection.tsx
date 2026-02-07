import { useSceneManager } from "@/src/pages/Editor";
import { Section } from "../section";
import { SectionTitle } from "../section-title";
import { IconButton } from "./icon-button";
import { Minus, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
} from "@/src/components/dropdown-menu";
import { useCallback } from "react";
import { blockUpdate } from "./shared-handlers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/select";
import { SelectPortal } from "@radix-ui/react-select";

export function ThemeSection({
  theme,
}: {
  theme?: "Mixed" | ReadonlyMap<string, string>;
}): React.JSX.Element {
  const manager = useSceneManager();

  const unspecifiedThemeAxes = [...manager.variableManager.themes.keys()]
    .filter((axis) => theme === "Mixed" || !theme?.has(axis))
    .sort();

  const handleAddAxis = useCallback(
    (axis: string) => {
      const newTheme: ReadonlyMap<string, string> = new Map([
        ...(!theme || theme === "Mixed" ? [] : theme.entries()),
        [axis, manager.variableManager.themes.get(axis)![0]],
      ]);
      blockUpdate(manager, (block, node) =>
        block.update(node, { theme: newTheme }),
      );
    },
    [manager, theme],
  );

  const handleRemoveAxis = useCallback(
    (axis: string) => {
      let newTheme: Map<string, string> | undefined;
      if (theme && theme !== "Mixed" && theme.size !== 1) {
        newTheme = new Map(theme);
        newTheme.delete(axis);
      }
      blockUpdate(manager, (block, node) =>
        block.update(node, { theme: newTheme }),
      );
    },
    [manager, theme],
  );

  const handleChangeAxis = useCallback(
    (axis: string, value: string) => {
      const newTheme = new Map(theme && theme !== "Mixed" ? theme : []);
      newTheme.set(axis, value);
      blockUpdate(manager, (block, node) =>
        block.update(node, { theme: newTheme }),
      );
    },
    [manager, theme],
  );

  return manager.variableManager.themes.size !== 0 ? (
    <Section>
      <div className="flex items-center justify-between text-secondary-foreground">
        <SectionTitle title="Theme" />
        {unspecifiedThemeAxes.length !== 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton icon={Plus} />
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent>
                {unspecifiedThemeAxes.map((axis) => (
                  <DropdownMenuItem
                    key={axis}
                    onSelect={() => handleAddAxis(axis)}
                  >
                    {axis}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        )}
      </div>
      {theme === "Mixed" ? (
        <div className="text-center opacity-60">Mixed themes</div>
      ) : (
        [...(theme?.entries() ?? [])]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([axis, selectedValue]) => (
            <div className="flex flex-row gap-1" key={axis}>
              <Select
                value={selectedValue}
                onValueChange={(value) => handleChangeAxis(axis, value)}
              >
                <SelectTrigger data-size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectPortal>
                  <SelectContent>
                    {manager.variableManager.themes.get(axis)!.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
              <IconButton icon={Minus} onClick={() => handleRemoveAxis(axis)} />
            </div>
          ))
      )}
    </Section>
  ) : (
    <></>
  );
}
