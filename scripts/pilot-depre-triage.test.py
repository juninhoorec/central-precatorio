import json, os, re, unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PILOT = os.path.join(ROOT, "evidence", "pilot-triage-20261010", "pilot-50-selection.jsonl")

class PilotTriageContract(unittest.TestCase):
    def test_exactly_50_unique_depres(self):
        rows = [json.loads(line) for line in open(PILOT, encoding="utf8")]
        self.assertEqual(len(rows), 50)
        self.assertEqual(len({row["depre"] for row in rows}), 50)
        self.assertTrue(all(re.fullmatch(r"\d{7}-\d{2}\.\d{4}\.8\.26\.\d{4}", row["depre"]) for row in rows))

    def test_process_origin_is_separate(self):
        rows = [json.loads(line) for line in open(PILOT, encoding="utf8")]
        self.assertTrue(all(row["depre"] != row["originProcessOriginal"] for row in rows))
        self.assertTrue(all(row["depreOriginal"] == row["depre"] for row in rows))

    def test_no_operational_promotion(self):
        rows = [json.loads(line) for line in open(PILOT, encoding="utf8")]
        self.assertTrue(all(row["researchStatus"] == "NOT_YET_RESEARCHED" for row in rows))
        self.assertTrue(all(row["qualifiedEvidenceCount"] == 0 and row["readyForAnalyst"] is False for row in rows))

if __name__ == "__main__": unittest.main()
