import { beforeEach, describe, expect, it } from "vitest";
import { useStageData } from "@/stores/stage-data";

describe("useStageData — ShellData slice", () => {
  beforeEach(() => {
    useStageData.getState().clearShellData();
  });

  it("shellData vaut null au boot", () => {
    expect(useStageData.getState().shellData).toBeNull();
  });

  it("setShellData remplit le slice avec title + items", () => {
    useStageData.getState().setShellData("Outils", [{ t: "gmail", s: "3 résultats" }]);
    const { shellData } = useStageData.getState();
    expect(shellData).not.toBeNull();
    expect(shellData?.railTitle).toBe("Outils");
    expect(shellData?.railItems).toHaveLength(1);
    expect(shellData?.railItems[0]).toEqual({ t: "gmail", s: "3 résultats" });
  });

  it("clearShellData remet shellData à null après set", () => {
    useStageData.getState().setShellData("Outils", [{ t: "gmail", s: "3 résultats" }]);
    expect(useStageData.getState().shellData).not.toBeNull();
    useStageData.getState().clearShellData();
    expect(useStageData.getState().shellData).toBeNull();
  });

  it("setShellData appelé deux fois remplace complètement (pas de merge)", () => {
    useStageData.getState().setShellData("Premier", [
      { t: "a", s: "x" },
      { t: "b", s: "y" },
    ]);
    useStageData.getState().setShellData("Second", [{ t: "c", s: "z", hot: true }]);
    const { shellData } = useStageData.getState();
    expect(shellData?.railTitle).toBe("Second");
    expect(shellData?.railItems).toHaveLength(1);
    expect(shellData?.railItems[0]).toEqual({ t: "c", s: "z", hot: true });
  });
});
