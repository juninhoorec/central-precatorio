"use client";

import { useEffect, useState } from "react";
import type { ManualResearchTask, ResearchInstructions, SearchStrategy } from "@/lib/manual-research";

export default function ManualResearchPage() {
  const [tasks, setTasks] = useState<ManualResearchTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ManualResearchTask | null>(null);
  const [evidenceForm, setEvidenceForm] = useState({
    officialUrl: "",
    documentIdentifier: "",
    documentReference: "",
    documentDate: "",
    evidenceNotes: "",
  });

  useEffect(() => {
    async function fetchTasks() {
      const res = await fetch("/api/manual-research/tasks");
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks as ManualResearchTask[]);
      }
    }
    fetchTasks();
  }, []);

  const fetchTasksData = async () => {
    const res = await fetch("/api/manual-research/tasks");
    const data = await res.json();
    if (data.tasks) setTasks(data.tasks as ManualResearchTask[]);
  };

  const runPilot = async () => {
    await fetch("/api/manual-research/pilot", { method: "POST", body: JSON.stringify({}) });
    fetchTasksData();
  };

  const submitEvidence = async () => {
    if (!selectedTask) return;
    await fetch(`/api/manual-research/tasks/${selectedTask.id}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...evidenceForm,
        operationId: selectedTask.operationId,
        depre: selectedTask.depre,
        source: selectedTask.source,
      }),
    });
    setSelectedTask(null);
    fetchTasksData();
  };

  const instructions = selectedTask?.instructions as ResearchInstructions | undefined;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Manual Research Tasks — Phase 6</h1>
      <div className="mb-4 flex gap-4 items-center">
        <button onClick={runPilot} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Run 20-Case Pilot
        </button>
        <span className="text-sm text-gray-500">{tasks.length} tasks loaded</span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 border-r pr-4">
          <h2 className="text-xl font-semibold mb-2">Open Tasks</h2>
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li
                key={t.id}
                onClick={() => setSelectedTask(t)}
                className={`p-3 border rounded cursor-pointer ${
                  selectedTask?.id === t.id ? "bg-blue-50 border-blue-400" : "hover:bg-gray-50"
                }`}
              >
                <div className="font-bold text-sm">{t.depre}</div>
                <div className="text-xs text-gray-600">Priority: {t.priority} | Status: {t.status}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2">
          {selectedTask && instructions ? (
            <div>
              <h2 className="text-xl font-bold mb-2">Task: {selectedTask.depre}</h2>
              <div className="text-xs text-gray-500 mb-4">
                ID: {selectedTask.id} | Source: {selectedTask.source} | Route: {selectedTask.route} | Blocker: {selectedTask.blockerType}
              </div>

              <div className="bg-gray-50 p-4 rounded mb-6 space-y-3 text-sm">
                <div><strong>Objective:</strong> {instructions.objective}</div>
                <div><strong>Primary Source:</strong>{" "}
                  <a href={instructions.primaryUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    {instructions.primarySource}
                  </a>
                </div>
                <div><strong>What to Look For:</strong> {instructions.whatToLookFor}</div>

                <div>
                  <strong>Success Condition:</strong>
                  <div className="bg-green-50 border border-green-200 p-2 mt-1 rounded">{instructions.successCondition}</div>
                </div>

                <div>
                  <strong>Search Strategies:</strong>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {instructions.strategies.map((s: SearchStrategy, i: number) => (
                      <li key={i}>
                        <strong>{s.label}</strong> ({s.identifierType}: <code className="bg-gray-200 px-1">{s.identifier}</code>):
                        {" "}{s.instruction}
                      </li>
                    ))}
                  </ul>
                </div>

                {instructions.alreadyAttempted.length > 0 && (
                  <div>
                    <strong>Previous Attempts:</strong>
                    <ul className="list-disc pl-5 mt-1 text-gray-600">
                      {instructions.alreadyAttempted.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}

                <div>
                  <strong className="text-red-600">Do NOT Repeat:</strong>
                  <ul className="list-disc pl-5 mt-1 text-red-600">
                    {instructions.doNotRepeat.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <strong>Fields to Capture:</strong>
                  <ul className="list-disc pl-5 mt-1">
                    {instructions.captureFields.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-2 rounded">
                  <strong>Next Step After Submission:</strong> {instructions.nextStepAfterSubmission}
                </div>
              </div>

              {selectedTask.status !== "COMPLETED" && selectedTask.status !== "CANCELLED" && (
                <div className="border p-4 rounded">
                  <h3 className="text-lg font-semibold mb-4">Submit Evidence</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium">Official URL (HTTPS required)</label>
                      <input
                        type="url"
                        className="border p-2 w-full mt-1"
                        placeholder="https://esaj.tjsp.jus.br/..."
                        value={evidenceForm.officialUrl}
                        onChange={(e) => setEvidenceForm({ ...evidenceForm, officialUrl: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Document Identifier</label>
                      <input
                        type="text"
                        className="border p-2 w-full mt-1"
                        placeholder="Process number, ofício number, etc."
                        value={evidenceForm.documentIdentifier}
                        onChange={(e) => setEvidenceForm({ ...evidenceForm, documentIdentifier: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Document Reference</label>
                      <input
                        type="text"
                        className="border p-2 w-full mt-1"
                        placeholder="Short description of what was found"
                        value={evidenceForm.documentReference}
                        onChange={(e) => setEvidenceForm({ ...evidenceForm, documentReference: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Document Date</label>
                      <input
                        type="date"
                        className="border p-2 w-full mt-1"
                        value={evidenceForm.documentDate}
                        onChange={(e) => setEvidenceForm({ ...evidenceForm, documentDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Analyst Notes</label>
                      <textarea
                        className="border p-2 w-full mt-1"
                        rows={3}
                        placeholder="Describe what was found and how it confirms the DEPRE"
                        value={evidenceForm.evidenceNotes}
                        onChange={(e) => setEvidenceForm({ ...evidenceForm, evidenceNotes: e.target.value })}
                      />
                    </div>
                    <button
                      onClick={submitEvidence}
                      disabled={!evidenceForm.officialUrl || !evidenceForm.documentIdentifier}
                      className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-green-700"
                    >
                      Submit Evidence → EvidenceCandidate → EvidenceResolver
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      Evidence will follow canonical pipeline: EvidenceCandidate → EvidenceResolver → OfficialEvidenceDocument. The 2/2 gate remains enforced.
                    </p>
                  </div>
                </div>
              )}

              {(selectedTask.status === "COMPLETED" || selectedTask.status === "CANCELLED") && (
                <div className="bg-gray-100 p-4 rounded text-sm text-gray-600">
                  Task is {selectedTask.status}. Reason: {selectedTask.completedReason ?? "N/A"}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 flex items-center justify-center h-64">
              Select a task from the list to view case-specific instructions
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
