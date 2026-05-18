/**
 * Tests — workflow templates hospitality (2 templates valident validateGraph).
 */
import { describe, expect, it, vi } from "vitest";
import { executeWorkflow } from "@/lib/workflows/executor";
import {
  getTemplateById,
  getTemplatesByVertical,
  WORKFLOW_TEMPLATES,
} from "@/lib/workflows/templates";
import type { WorkflowExecutionContext, WorkflowExecutorEvent } from "@/lib/workflows/types";
import { validateGraph } from "@/lib/workflows/validate";

function makeCtx(): WorkflowExecutionContext {
  return {
    userId: "u",
    tenantId: "t",
    workspaceId: "w",
    runId: "r-test",
    outputs: new Map(),
  };
}

describe("hospitality workflow templates", () => {
  it("guest-arrival-prep est valide via validateGraph", () => {
    const tpl = getTemplateById("hospitality-guest-arrival-prep");
    expect(tpl).toBeDefined();
    const graph = tpl!.build();
    expect(graph).toBeDefined();
    const result = validateGraph(graph!);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("service-request-dispatch est valide via validateGraph", () => {
    const tpl = getTemplateById("hospitality-service-request-dispatch");
    expect(tpl).toBeDefined();
    const graph = tpl!.build();
    expect(graph).toBeDefined();
    const result = validateGraph(graph!);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("getTemplatesByVertical('hospitality') retourne les 2 templates", () => {
    const out = getTemplatesByVertical("hospitality");
    expect(out).toHaveLength(2);
    expect(out.map((t) => t.id).sort()).toEqual(
      ["hospitality-guest-arrival-prep", "hospitality-service-request-dispatch"].sort(),
    );
  });

  it("WORKFLOW_TEMPLATES inclut les templates hospitality au catalog", () => {
    const ids = WORKFLOW_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("hospitality-guest-arrival-prep");
    expect(ids).toContain("hospitality-service-request-dispatch");
  });

  it("guest-arrival-prep contient bien un node approval + start cron", () => {
    const tpl = getTemplateById("hospitality-guest-arrival-prep");
    expect(tpl).toBeDefined();
    const graph = tpl!.build();
    expect(graph).toBeDefined();
    const kinds = graph!.nodes.map((n) => n.kind);
    expect(kinds).toContain("approval");
    expect(graph!.nodes.find((n) => n.id === graph!.startNodeId)?.kind).toBe("trigger");
  });

  it("service-request-dispatch branche urgent/normal via condition", () => {
    const tpl = getTemplateById("hospitality-service-request-dispatch");
    expect(tpl).toBeDefined();
    const graph = tpl!.build();
    expect(graph).toBeDefined();
    const cond = graph!.nodes.find((n) => n.kind === "condition");
    expect(cond).toBeDefined();
    const branches = graph!.edges.filter((e) => e.source === cond?.id);
    expect(branches.length).toBeGreaterThanOrEqual(2);
    const conditions = branches.map((b) => b.condition).sort();
    expect(conditions).toContain("true");
    expect(conditions).toContain("false");
  });

  it("service-request-dispatch possède une edge condition:error depuis update_pms vers out_pms_update_skipped", () => {
    const tpl = getTemplateById("hospitality-service-request-dispatch");
    expect(tpl).toBeDefined();
    const graph = tpl!.build()!;
    // Edge error depuis update_pms
    const errorEdge = graph.edges.find((e) => e.source === "update_pms" && e.condition === "error");
    expect(errorEdge).toBeDefined();
    expect(errorEdge!.target).toBe("out_pms_update_skipped");
    // Node out_pms_update_skipped est bien de kind output
    const skipNode = graph.nodes.find((n) => n.id === "out_pms_update_skipped");
    expect(skipNode).toBeDefined();
    expect(skipNode!.kind).toBe("output");
    // Payload honnête : kind issue, severity warning, aucune donnée PMS fictive
    const payload = skipNode!.config.payload as Record<string, unknown>;
    expect(payload.kind).toBe("issue");
    expect(payload.severity).toBe("warning");
    // Pas de champ count ni de valeur PMS fictive
    expect(payload.count).toBeUndefined();
    expect(payload.pmsStatus).toBeUndefined();
  });

  it("service-request-dispatch sans PMS → ticket `out` TOUJOURS produit + out_pms_update_skipped honnête", async () => {
    const tpl = getTemplateById("hospitality-service-request-dispatch");
    expect(tpl).toBeDefined();
    const graph = tpl!.build()!;

    const ctx = makeCtx();
    // Pré-peuple le trigger avec des données réalistes
    ctx.outputs.set("trigger_webhook", {
      id: "req-42",
      type: "housekeeping",
      room: "204",
      guestName: "Martin Dupont",
      text: "Serviettes supplémentaires",
    });

    const events: WorkflowExecutorEvent[] = [];
    // Simule : classify OK (normal), Slack OK, PMS non configuré
    const executeTool = vi.fn(async (tool: string) => {
      if (tool === "ai_classify_priority") {
        return { success: true as const, output: { priority: "normal" } };
      }
      if (tool === "slack_send_message") {
        return { success: true as const, output: { sent: true } };
      }
      if (tool === "pms_update_request_status") {
        return { success: false as const, error: "pms_not_configured" };
      }
      return { success: true as const, output: null };
    });

    const result = await executeWorkflow(graph, ctx, {
      executeTool,
      emitEvent: (e) => events.push(e),
    });

    // Workflow terminé en completed (skip policy préserve le run)
    expect(result.status).toBe("completed");

    // Le ticket de traçabilité doit TOUJOURS être produit
    const ticketOutput = result.outputs.find((o) => o.nodeId === "out");
    expect(ticketOutput).toBeDefined();
    const ticketPayload = (ticketOutput!.output as { payload: Record<string, unknown> }).payload;
    expect(ticketPayload.kind).toBe("task");
    // Aucune fausse donnée PMS dans le ticket
    expect(ticketPayload.pmsUpdated).toBeUndefined();
    expect(ticketPayload.pmsStatus).toBeUndefined();

    // L'issue honnête doit être produit
    const skipOutput = result.outputs.find((o) => o.nodeId === "out_pms_update_skipped");
    expect(skipOutput).toBeDefined();
    const skipPayload = (skipOutput!.output as { payload: Record<string, unknown> }).payload;
    expect(skipPayload.kind).toBe("issue");
    expect(skipPayload.severity).toBe("warning");
    // Aucune donnée PMS fictive dans l'issue
    expect(skipPayload.count).toBeUndefined();

    // update_pms doit avoir été skippé (event step_skipped émis)
    expect(
      events.some(
        (e) => e.type === "step_skipped" && (e as { nodeId: string }).nodeId === "update_pms",
      ),
    ).toBe(true);

    // Slack (route_normal) a bien été appelé
    const calledTools = executeTool.mock.calls.map(([t]) => t);
    expect(calledTools).toContain("slack_send_message");
    // pms_update_request_status a bien été tenté (pas simplement ignoré)
    expect(calledTools).toContain("pms_update_request_status");
  });

  it("service-request-dispatch chemin nominal (PMS branché) → ticket + PMS mis à jour, aucun skip", async () => {
    const tpl = getTemplateById("hospitality-service-request-dispatch");
    expect(tpl).toBeDefined();
    const graph = tpl!.build()!;

    const ctx = makeCtx();
    ctx.outputs.set("trigger_webhook", {
      id: "req-99",
      type: "maintenance",
      room: "310",
      guestName: "Sophie Bernard",
      text: "Climatisation en panne",
    });

    const events: WorkflowExecutorEvent[] = [];
    // Simule : classify urgent, Slack OK, PMS OK (branché)
    const executeTool = vi.fn(async (tool: string) => {
      if (tool === "ai_classify_priority") {
        return { success: true as const, output: { priority: "urgent" } };
      }
      if (tool === "slack_send_message") {
        return { success: true as const, output: { sent: true } };
      }
      if (tool === "pms_update_request_status") {
        return { success: true as const, output: { updated: true } };
      }
      return { success: true as const, output: null };
    });

    const result = await executeWorkflow(graph, ctx, {
      executeTool,
      emitEvent: (e) => events.push(e),
    });

    expect(result.status).toBe("completed");

    // Ticket toujours produit
    const ticketOutput = result.outputs.find((o) => o.nodeId === "out");
    expect(ticketOutput).toBeDefined();

    // PMS mis à jour
    const pmsOutput = result.outputs.find((o) => o.nodeId === "update_pms");
    expect(pmsOutput).toBeDefined();

    // Aucun node "skipped" — chemin nominal intact
    expect(events.some((e) => e.type === "step_skipped")).toBe(false);

    // out_pms_update_skipped ne doit PAS être dans les outputs
    const skipOutput = result.outputs.find((o) => o.nodeId === "out_pms_update_skipped");
    expect(skipOutput).toBeUndefined();
  });

  it("guest-arrival-prep possède une edge condition:error depuis fetch_arrivals vers out_pms_missing", () => {
    const tpl = getTemplateById("hospitality-guest-arrival-prep");
    expect(tpl).toBeDefined();
    const graph = tpl!.build()!;
    const errorEdge = graph.edges.find(
      (e) => e.source === "fetch_arrivals" && e.condition === "error",
    );
    expect(errorEdge).toBeDefined();
    expect(errorEdge!.target).toBe("out_pms_missing");
    const pmsNode = graph.nodes.find((n) => n.id === "out_pms_missing");
    expect(pmsNode).toBeDefined();
    expect(pmsNode!.kind).toBe("output");
    // L'asset honnête ne doit contenir aucun champ "count" ni "content" lié aux arrivées
    const payload = pmsNode!.config.payload as Record<string, unknown>;
    expect(payload.count).toBeUndefined();
    expect(payload.kind).toBe("issue");
  });

  it("guest-arrival-prep sans PMS → asset issue honnête, aucun asset brief VIP", async () => {
    const tpl = getTemplateById("hospitality-guest-arrival-prep");
    expect(tpl).toBeDefined();
    const graph = tpl!.build()!;

    const events: WorkflowExecutorEvent[] = [];
    // Simule PMS non configuré : pms_list_arrivals_today échoue
    const executeTool = vi.fn(async (tool: string) => {
      if (tool === "pms_list_arrivals_today") {
        return { success: false as const, error: "pms_not_configured" };
      }
      // Ne doit pas être appelé dans ce chemin
      return { success: true as const, output: null };
    });

    const result = await executeWorkflow(graph, makeCtx(), {
      executeTool,
      emitEvent: (e) => events.push(e),
    });

    // Le workflow se termine en completed (pas en failed — skip policy)
    expect(result.status).toBe("completed");

    // L'asset brief VIP normal (out) ne doit PAS être dans les outputs
    const briefOutput = result.outputs.find((o) => o.nodeId === "out");
    expect(briefOutput).toBeUndefined();

    // L'issue honnête (out_pms_missing) doit être dans les outputs
    const issueOutput = result.outputs.find((o) => o.nodeId === "out_pms_missing");
    expect(issueOutput).toBeDefined();
    const payload = (issueOutput!.output as { payload: Record<string, unknown> }).payload;
    expect(payload.kind).toBe("issue");
    expect(payload.count).toBeUndefined();

    // Les tools nominaux (ai_draft_welcome_notes, slack_send_message) ne sont pas appelés
    const calledTools = executeTool.mock.calls.map(([t]) => t);
    expect(calledTools).not.toContain("ai_draft_welcome_notes");
    expect(calledTools).not.toContain("slack_send_message");

    // Un event step_skipped doit être émis pour fetch_arrivals
    expect(
      events.some(
        (e) => e.type === "step_skipped" && (e as { nodeId: string }).nodeId === "fetch_arrivals",
      ),
    ).toBe(true);
  });
});
