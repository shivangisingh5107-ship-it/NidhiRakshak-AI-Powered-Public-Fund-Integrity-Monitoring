"""
NidhiRakshak — dataset builder
=================================
Combines REAL government data (MP roster, constituency, allocated limits from
the Ministry's published allocation list) with CLEARLY LABELLED SYNTHETIC
work-level transactions (sanction/expenditure/completion records), since
per-work public data was not supplied for this prototype.

Every output row carries a `record_source` column so nobody can mistake
simulated rows for verified government records:
    "REAL_GOVT_DATA"      -> mp_name, state, constituency, allocated_limit
    "SYNTHETIC_DEMO_DATA" -> every work-level financial/operational field

A `synthetic_ground_truth_fraud` column is also injected purely so the demo
can report detector accuracy against a KNOWN answer key. It has no bearing on
any real person or real allegation — it only exists inside the synthetic
work rows this script generates.
"""
import pandas as pd
import numpy as np
import random
import json
from pathlib import Path
from datetime import datetime, timedelta

np.random.seed(42)
random.seed(42)

PIPE_DIR = Path(__file__).resolve().parent
REAL_ROSTER_PATH = PIPE_DIR / "real_roster_lok_sabha_18.csv"
OUT_DIR = PIPE_DIR

WORK_CATEGORIES = {
    "Community Hall Construction": (800000, 1500000),
    "Drinking Water Facility": (300000, 700000),
    "Road Construction/Repair": (1000000, 3000000),
    "School Building Repair": (500000, 1200000),
    "Drainage System": (400000, 900000),
    "Solar Street Lighting": (200000, 500000),
    "Health Sub-Centre Upgrade": (600000, 1400000),
    "Sports Facility Development": (500000, 1100000),
    "Anganwadi Centre Upgrade": (300000, 650000),
    "Public Toilet Complex": (250000, 550000),
    "Crematorium/Cemetery Development": (300000, 700000),
    "Library / Reading Room": (350000, 800000),
}

IMPLEMENTING_AGENCIES = [f"{prefix} Agency {i}" for prefix, i in
                         [("District Rural Dev.", 1), ("PWD", 2), ("Zilla Parishad", 3),
                          ("Municipal Corp.", 4), ("State PSU", 5), ("NGO Partner", 6),
                          ("Cooperative Board", 7), ("Panchayati Raj", 8), ("PWD", 9),
                          ("District Rural Dev.", 10)]]
IMPLEMENTING_AGENCIES += [f"Contractor Firm {i}" for i in range(1, 19)]

VAGUE_DESCRIPTIONS = [
    "Development work as per requirement",
    "General infrastructure improvement",
    "Construction of community asset",
    "Basic amenity provision work",
    "Miscellaneous civil work as needed",
    "Infrastructure upgrade work",
]

STATUS_OPTIONS = ["Completed", "In Progress", "Stalled", "Sanctioned - Not Started"]


def random_date(start_year=2021, end_year=2025, month_bias=None):
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    if month_bias == "year_end_rush":
        # bias toward Jan-March (Indian financial year close)
        year = random.randint(start_year, end_year)
        month = random.choices([1, 2, 3] + list(range(4, 13)),
                                weights=[6, 8, 10] + [3] * 9)[0]
        day = random.randint(1, 28)
        return datetime(year, month, day)
    delta = end - start
    return start + timedelta(days=random.randint(0, delta.days))


def load_real_roster():
    df = pd.read_csv(REAL_ROSTER_PATH)
    df.columns = [c.strip() for c in df.columns]
    # The supplied 18th Lok Sabha allocation PDF is parsed into this clean CSV.
    # Keep the official source MP IDs so synthetic demo works can join to the
    # same real roster shown in the Real-data view.
    df["mp_name"] = (df["mp_name"].fillna("")
                     .str.replace(r"\s*\(\d{4}-\d{4}\)$", "", regex=True)
                     .str.strip().str.title())
    df["state"] = df["state"].str.replace(r"^The ", "", regex=True).str.strip()
    df["constituency"] = df["constituency"].fillna("").str.strip()
    # Some MPs (e.g. mid-term replacements, single-seat UTs) have no
    # constituency recorded in the source PDF. Leaving this blank causes
    # pandas groupby() calls downstream to silently DROP those MPs (NaN/blank
    # group keys are excluded by default), which is how LS108/LS224/LS324
    # went missing from mps.json in a previous build. Give them an explicit,
    # honest placeholder instead of leaving it blank.
    df.loc[df["constituency"] == "", "constituency"] = "Not Specified"
    df["allocated_limit"] = pd.to_numeric(df["allocated_limit"], errors="coerce")
    df["mp_id"] = df["mp_id"].astype(str).str.strip()
    return df[["mp_id", "mp_name", "state", "constituency", "allocated_limit"]]


def build_district_lookup(roster):
    # Synthetic district naming derived from constituency (kept simple + stable)
    lookup = {}
    for _, r in roster.iterrows():
        lookup[r["mp_id"]] = f"{r['constituency']} District"
    return lookup


def generate_works(roster):
    rows = []
    district_lookup = build_district_lookup(roster)
    all_mp_ids = roster["mp_id"].tolist()

    # ~9% of MPs are seeded as "high-risk profile" for demo purposes
    suspicious_mp_ids = set(random.sample(all_mp_ids, max(1, int(len(all_mp_ids) * 0.09))))
    # ~5% more get a *milder* single-signal issue (keeps things realistic — not everyone
    # flagged is a dramatic fraud case; some are just inefficient)
    inefficient_mp_ids = set(random.sample(
        [m for m in all_mp_ids if m not in suspicious_mp_ids],
        max(1, int(len(all_mp_ids) * 0.05))
    ))

    work_counter = 0
    for _, mp in roster.iterrows():
        mp_id = mp["mp_id"]
        district = district_lookup[mp_id]
        n_works = random.randint(10, 26)
        is_suspicious = mp_id in suspicious_mp_ids
        is_inefficient = mp_id in inefficient_mp_ids

        # give each suspicious MP 1-2 "favourite" agencies to concentrate work with
        favourite_agency = random.choice(IMPLEMENTING_AGENCIES)

        # occasionally cluster several works sanctioned same day (possible work-splitting)
        split_batch_day = random_date(2022, 2024) if (is_suspicious and random.random() < 0.6) else None

        for w in range(n_works):
            work_counter += 1
            category = random.choice(list(WORK_CATEGORIES.keys()))
            low, high = WORK_CATEGORIES[category]
            base_cost = random.uniform(low, high)

            anomaly_roll = random.random()
            inject_anomaly = is_suspicious and anomaly_roll < 0.45
            inject_mild_issue = (not inject_anomaly) and is_inefficient and anomaly_roll < 0.35

            ground_truth_fraud = 0
            issue_tags = []

            if inject_anomaly:
                ground_truth_fraud = 1
                pattern = random.choice(
                    ["cost_inflation", "ghost_utilization", "vague_duplicate",
                     "agency_monopoly", "work_splitting", "stalled_after_payment"]
                )
                issue_tags.append(pattern)

                if pattern == "cost_inflation":
                    cost_sanctioned = base_cost * random.uniform(2.3, 4.2)
                    completion_lag_days = random.randint(120, 420)
                    description = f"{category} in {district} ward {random.randint(1, 20)}"
                    agency = favourite_agency
                    expenditure_ratio = random.uniform(0.85, 1.0)
                    sanction_date = random_date(2021, 2024)
                elif pattern == "ghost_utilization":
                    cost_sanctioned = base_cost * random.uniform(0.95, 1.3)
                    completion_lag_days = random.randint(600, 1400)
                    description = f"{category} in {district} ward {random.randint(1, 20)}"
                    agency = favourite_agency
                    expenditure_ratio = random.uniform(0.05, 0.3)
                    sanction_date = random_date(2021, 2023)
                elif pattern == "vague_duplicate":
                    cost_sanctioned = base_cost * random.uniform(0.9, 1.4)
                    completion_lag_days = random.randint(200, 500)
                    description = random.choice(VAGUE_DESCRIPTIONS)
                    agency = favourite_agency
                    expenditure_ratio = random.uniform(0.6, 1.0)
                    sanction_date = random_date(2021, 2024)
                elif pattern == "agency_monopoly":
                    cost_sanctioned = base_cost * random.uniform(1.0, 1.6)
                    completion_lag_days = random.randint(90, 300)
                    description = f"{category} in {district} ward {random.randint(1, 20)}"
                    agency = favourite_agency
                    expenditure_ratio = random.uniform(0.7, 1.0)
                    sanction_date = random_date(2021, 2024)
                elif pattern == "work_splitting":
                    cost_sanctioned = random.uniform(880000, 995000)  # just under 10L threshold
                    completion_lag_days = random.randint(100, 300)
                    description = f"{category} in {district} ward {random.randint(1, 20)} (Phase {random.randint(1,3)})"
                    agency = favourite_agency
                    expenditure_ratio = random.uniform(0.7, 1.0)
                    sanction_date = split_batch_day or random_date(2021, 2024)
                else:  # stalled_after_payment
                    cost_sanctioned = base_cost * random.uniform(1.1, 2.0)
                    completion_lag_days = random.randint(700, 1600)
                    description = f"{category} in {district} ward {random.randint(1, 20)}"
                    agency = favourite_agency
                    expenditure_ratio = random.uniform(0.55, 0.8)
                    sanction_date = random_date(2021, 2023)

                sanction_date = sanction_date if pattern != "cost_inflation" else random_date(2021, 2024, "year_end_rush")

            elif inject_mild_issue:
                issue_tags.append("mild_inefficiency")
                cost_sanctioned = base_cost * random.uniform(1.0, 1.4)
                completion_lag_days = random.randint(380, 650)
                description = f"{category} in {district} ward {random.randint(1, 20)}"
                agency = random.choice(IMPLEMENTING_AGENCIES)
                expenditure_ratio = random.uniform(0.4, 0.7)
                sanction_date = random_date(2021, 2024)
            else:
                cost_sanctioned = base_cost * random.uniform(0.88, 1.12)
                completion_lag_days = max(30, int(np.random.normal(180, 45)))
                description = f"{category} in {district} ward {random.randint(1, 20)}"
                agency = random.choice(IMPLEMENTING_AGENCIES)
                expenditure_ratio = random.uniform(0.78, 1.0)
                sanction_date = random_date(2021, 2024)

            expenditure = cost_sanctioned * expenditure_ratio
            completion_date = sanction_date + timedelta(days=int(completion_lag_days))
            today_cap = datetime(2026, 8, 1)
            if completion_date > today_cap:
                completion_date = today_cap

            if expenditure_ratio > 0.92:
                status = "Completed"
            elif expenditure_ratio > 0.55:
                status = "In Progress"
            elif expenditure_ratio > 0.15:
                status = "Stalled"
            else:
                status = "Sanctioned - Not Started"

            # a handful of suspiciously "round" costs (common red flag in real audits)
            if inject_anomaly and random.random() < 0.4:
                cost_sanctioned = round(cost_sanctioned, -4)  # round to nearest 10,000

            rows.append({
                "work_id": f"W{work_counter:06d}",
                "mp_id": mp_id,
                "mp_name": mp["mp_name"],
                "state": mp["state"],
                "constituency": mp["constituency"],
                "district": district,
                "allocated_limit": mp["allocated_limit"],
                "work_category": category,
                "work_description": description,
                "implementing_agency": agency,
                "sanction_date": sanction_date.strftime("%Y-%m-%d"),
                "cost_sanctioned": round(float(cost_sanctioned), 2),
                "expenditure": round(float(expenditure), 2),
                "completion_date": completion_date.strftime("%Y-%m-%d"),
                "status": status,
                "synthetic_ground_truth_fraud": ground_truth_fraud,
                "synthetic_issue_tags": ",".join(issue_tags),
                "record_source": "SYNTHETIC_DEMO_DATA",
            })

    return pd.DataFrame(rows)


def main():
    print("Loading REAL MP roster (allocation list)...")
    roster = load_real_roster()
    print(f"  {len(roster)} real MPs loaded across {roster['state'].nunique()} states")

    print("Generating SYNTHETIC work-level demo data on top of the real roster...")
    works = generate_works(roster)
    print(f"  {len(works)} synthetic work records generated")

    roster.to_csv(f"{OUT_DIR}/mp_roster_real.csv", index=False)
    works.to_csv(f"{OUT_DIR}/mplads_work_data.csv", index=False)

    meta = {
        "real_lok_sabha_count": int(len(roster)),
        "real_rajya_sabha_count": 231,
        "real_mp_count": 774,
        "synthetic_work_count": int(len(works)),
        "states_covered": int(roster["state"].nunique()),
        "generated_at": datetime.now().isoformat(),
        "sources": ["Allocated Limit for Honble MPs (3).pdf", "Allocated Limit for Honble MPs (4).pdf", "MPLADS eSAKSHI public dashboard"],
    }
    with open(f"{OUT_DIR}/dataset_meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    print("Done.", meta)


if __name__ == "__main__":
    main()
