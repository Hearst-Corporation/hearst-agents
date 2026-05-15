// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgressBlock, SegmentedRow } from "@/app/(user)/components/video-quick-launch/segments";

describe("SegmentedRow", () => {
  const OPTIONS = ["a", "b", "c"] as const;

  it("affiche le label et toutes les options", () => {
    render(
      <SegmentedRow
        label="Durée"
        options={OPTIONS}
        value="a"
        onChange={() => {}}
        getLabel={(v) => v.toUpperCase()}
        disabled={false}
      />,
    );
    expect(screen.getByText("Durée")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
  });

  it("appelle onChange quand on clique sur une option", () => {
    const onChange = vi.fn();
    render(
      <SegmentedRow
        label="Durée"
        options={OPTIONS}
        value="a"
        onChange={onChange}
        getLabel={(v) => v.toUpperCase()}
        disabled={false}
      />,
    );
    fireEvent.click(screen.getByText("B"));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("bloque les clics quand disabled=true", () => {
    const onChange = vi.fn();
    render(
      <SegmentedRow
        label="Durée"
        options={OPTIONS}
        value="a"
        onChange={onChange}
        getLabel={(v) => v.toUpperCase()}
        disabled
      />,
    );
    const btn = screen.getByText("B") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ProgressBlock", () => {
  it("affiche '—' et le errorMsg quand phase=error", () => {
    render(<ProgressBlock phase="error" progress={42} label="Erreur" errorMsg="Quota dépassé" />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("Quota dépassé")).toBeTruthy();
  });

  it("n'affiche pas de bloc d'erreur si errorMsg est null en phase error", () => {
    render(<ProgressBlock phase="error" progress={42} label="Erreur" errorMsg={null} />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText("Quota dépassé")).toBeNull();
  });

  it("affiche 100% quand phase=done", () => {
    render(<ProgressBlock phase="done" progress={100} label="Vidéo prête" errorMsg={null} />);
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("Vidéo prête")).toBeTruthy();
  });
});
