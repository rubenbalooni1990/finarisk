# SilQ Risk Score Calculator

A static, config-driven web app to score buyers and assign credit limits based on tiered parameters. Ready to host on GitHub Pages.

## Features
- **Config from Excel**: Convert your `tiers + parameters + weight + options + score` Excel into `config/config.json`.
- **Weighted scoring (0–10)**: Assumes each option is scored `0..10` and parameter weights sum to ~100.
- **Limit assignment logic**:
  - **Tier 1 (SCF – up to 100k SAR)**  
    - If Score ≤ 4 → Limit = 0  
    - If Score > 4 → Limit = `min(100,000, 10,000 + 50% of Avg Monthly Sales)`
  - **Tier 2 (SCF – up to 1M SAR)**  
    - If Score < 5 → Limit = 0  
    - If Score ≥ 5 → `Limit = (Score/10) × min(1,000,000, 50% of Avg Monthly Sales)`
  - **Tier 3 (SCF – above 1M SAR)**  
    - If Score < 5 → Limit = 0  
    - If Score ≥ 5 → `Limit = min(2,500,000, (Score/10) × 50% of Avg Monthly Sales)`
  - **Tier 4 (EDP)**  
    - If Score < 5 → Limit = 0  
    - If Score ≥ 5 → Manual (N/A in app)

> Adjust logic in `src/app.js` as needed.

## How to Use
1. Open `index.html` in a browser, or host the folder with any static server.
2. Pick a **Tier**, enter **Average Monthly Sales**, and select parameter options.
3. See the **weighted score** and **assigned limit**.
4. Click **Export Result JSON** to download the outcome.

## Deploy on GitHub Pages
1. Create a new GitHub repo, e.g., `silq-risk-score-calculator`.
2. Upload the contents of this folder (or just push via git).
3. In GitHub → **Settings** → **Pages** → **Build and deployment**:  
   - Source: **Deploy from a branch**  
   - Branch: `main` → `/root`  
4. Your app will be live at `https://<your-username>.github.io/<repo>/`.

## Update the Scoring Config
- Replace `config/config.json` with a new one.
- Optional: regenerate from Excel using a Python script similar to what was used to produce the initial `config.json` in this package.

## Data Model
`config/config.json`:
```json
{
  "tiers": {
    "Tier 1 : SCF / 100K": {
      "CR Status": {
        "weight": 10,
        "options": { "Active": 10, "Expired": 0 }
      }
    }
  }
}
```

## Notes
- If your Excel columns differ, the converter uses best-effort heuristics to detect: `Tier, Parameter, Weight, Option, Score`.
- If your weights don't sum to 100, the app still calculates a 0–10 score with the provided weights.
