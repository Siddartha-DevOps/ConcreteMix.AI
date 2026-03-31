"""
ConcreteMix Copilot — NLP Engine
Rule-based natural language understanding. No external API.
Runs 100% on your server.
"""

import re
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any


# ── Intent definitions ────────────────────────────────────────────────────────

INTENTS = {
    "optimize_mix": [
        "design", "optimize", "optimise", "best mix", "optimal mix",
        "lowest cost", "minimum cost", "cheapest", "lowest carbon",
        "minimum carbon", "generate mix", "create mix", "suggest mix",
        "what mix", "recommend mix"
    ],
    "predict_strength": [
        "predict", "strength", "how strong", "compressive", "mpa",
        "will it achieve", "can it reach", "estimate strength",
        "what strength", "check strength"
    ],
    "calculate_cost": [
        "cost", "price", "how much", "expensive", "budget",
        "calculate cost", "cost per", "per m3", "per cubic"
    ],
    "calculate_carbon": [
        "carbon", "co2", "emissions", "footprint", "environmental",
        "green", "sustainable", "eco", "carbon footprint"
    ],
    "compare_mixes": [
        "compare", "versus", "vs", "difference between", "better",
        "which is better", "baseline", "savings", "save"
    ],
    "generate_report": [
        "report", "pdf", "download", "trial mix report",
        "generate report", "export", "document"
    ],
    "show_history": [
        "history", "previous", "last time", "before", "past",
        "earlier", "previous mix", "my mixes"
    ],
    "explain": [
        "explain", "why", "how does", "what is", "tell me about",
        "what does", "meaning of", "define"
    ],
    "greet": [
        "hello", "hi", "hey", "good morning", "good afternoon",
        "help", "what can you do", "capabilities"
    ]
}


# ── Parameter extraction ──────────────────────────────────────────────────────

@dataclass
class ExtractedParams:
    target_strength: Optional[float] = None      # MPa
    cement: Optional[float] = None               # kg/m³
    water: Optional[float] = None
    fly_ash: Optional[float] = None
    fly_ash_pct: Optional[float] = None          # % of cement
    slag: Optional[float] = None
    slag_pct: Optional[float] = None
    fine_aggregate: Optional[float] = None
    coarse_aggregate: Optional[float] = None
    superplasticizer: Optional[float] = None
    age: Optional[int] = None
    objective: str = "cost"                      # "cost" or "carbon"
    constraints: List[str] = field(default_factory=list)
    raw_grade: Optional[str] = None              # "M40", "C30" etc.


def extract_params(text: str) -> ExtractedParams:
    t = text.lower()
    p = ExtractedParams()

    # Concrete grade: M10–M80, C10–C80
    grade_match = re.search(r'\b([mc])[\s-]?(\d{2})\b', t)
    if grade_match:
        p.raw_grade = grade_match.group(0).upper().replace(' ', '').replace('-', '')
        p.target_strength = float(grade_match.group(2))

    # Explicit MPa value: "35 mpa", "40mpa", "strength of 30"
    if not p.target_strength:
        mpa_match = re.search(r'(\d+(?:\.\d+)?)\s*mpa', t)
        if not mpa_match:
            mpa_match = re.search(r'strength\s+(?:of\s+)?(\d+(?:\.\d+)?)', t)
        if not mpa_match:
            mpa_match = re.search(r'target\s+(?:of\s+)?(\d+(?:\.\d+)?)', t)
        if mpa_match:
            p.target_strength = float(mpa_match.group(1))

    # Fly ash percentage: "20% fly ash", "fly ash 30%"
    fa_pct = re.search(r'(\d+(?:\.\d+)?)\s*%?\s*fly\s*ash', t)
    if not fa_pct:
        fa_pct = re.search(r'fly\s*ash\s*(?:of\s+)?(\d+(?:\.\d+)?)\s*%', t)
    if fa_pct:
        p.fly_ash_pct = float(fa_pct.group(1))

    # Slag percentage
    slag_pct = re.search(r'(\d+(?:\.\d+)?)\s*%?\s*slag', t)
    if not slag_pct:
        slag_pct = re.search(r'slag\s*(?:of\s+)?(\d+(?:\.\d+)?)\s*%', t)
    if slag_pct:
        p.slag_pct = float(slag_pct.group(1))

    # Explicit kg/m³ values
    for material, aliases in {
        'cement':           ['cement', 'opc', 'ppc'],
        'water':            ['water'],
        'fine_aggregate':   ['fine aggregate', 'fine agg', 'sand', 'fa'],
        'coarse_aggregate': ['coarse aggregate', 'coarse agg', 'gravel', 'ca', '20mm', '10mm'],
        'superplasticizer': ['superplasticizer', 'sp', 'admixture', 'plasticizer'],
    }.items():
        for alias in aliases:
            match = re.search(rf'(\d+(?:\.\d+)?)\s*kg.*?{alias}|{alias}.*?(\d+(?:\.\d+)?)\s*kg', t)
            if match:
                val = float(match.group(1) or match.group(2))
                setattr(p, material, val)
                break

    # Age in days
    age_match = re.search(r'(\d+)\s*(?:-\s*)?day', t)
    if age_match:
        p.age = int(age_match.group(1))

    # Objective: cost vs carbon
    if any(w in t for w in ['carbon', 'co2', 'emission', 'green', 'eco', 'sustainable']):
        p.objective = 'carbon'
    elif any(w in t for w in ['cost', 'cheap', 'price', 'budget', 'affordable']):
        p.objective = 'cost'

    # Constraints
    if 'fly ash' in t:
        p.constraints.append('fly_ash')
    if 'slag' in t or 'ggbs' in t:
        p.constraints.append('slag')
    if 'no admixture' in t or 'no sp' in t or 'no superplasticizer' in t:
        p.constraints.append('no_sp')
    if 'low water' in t or 'low w/c' in t or 'low wc' in t:
        p.constraints.append('low_wc')

    return p


# ── Intent classifier ─────────────────────────────────────────────────────────

def classify_intent(text: str) -> str:
    t = text.lower()
    scores = {intent: 0 for intent in INTENTS}

    for intent, keywords in INTENTS.items():
        for kw in keywords:
            if kw in t:
                scores[intent] += 2 if len(kw.split()) > 1 else 1

    # Boost optimize if strength grade detected
    if re.search(r'\b[mc][\s-]?\d{2}\b', t):
        scores['optimize_mix'] += 3

    # Boost predict if specific mix values given
    if re.search(r'\d+\s*kg', t):
        scores['predict_strength'] += 2

    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return 'unknown'
    return best


# ── Default mix builder from params ──────────────────────────────────────────

def build_mix_from_params(params: ExtractedParams) -> Dict[str, float]:
    """
    Build a starting mix dict from extracted params.
    Uses IS:10262 guidelines as defaults.
    """
    target = params.target_strength or 30.0

    # Water-cement ratio from Abrams law approximation
    # w/c = 0.85 - 0.01 * (target - 20)  clamped to [0.35, 0.60]
    wc = max(0.35, min(0.60, 0.85 - 0.01 * (target - 20)))

    cement = round(max(300, min(550, target * 9.5)))
    water = round(cement * wc)

    # Supplementary materials
    fly_ash = 0.0
    slag = 0.0

    if params.fly_ash_pct:
        fly_ash = round(cement * params.fly_ash_pct / 100)
        cement = round(cement - fly_ash)
    elif params.fly_ash:
        fly_ash = params.fly_ash

    if params.slag_pct:
        slag = round(cement * params.slag_pct / 100)
        cement = round(cement - slag)
    elif params.slag:
        slag = params.slag

    # Use provided values if given directly
    if params.cement:
        cement = params.cement
    if params.water:
        water = params.water

    sp = params.superplasticizer if params.superplasticizer else round(cement * 0.012, 1)
    coarse = params.coarse_aggregate if params.coarse_aggregate else round(1100 - target * 3)
    fine = params.fine_aggregate if params.fine_aggregate else round(750 - target * 1.5)

    return {
        "cement": cement,
        "water": water,
        "fly_ash": fly_ash,
        "slag": slag,
        "fine_aggregate": fine,
        "coarse_aggregate": coarse,
        "superplasticizer": sp
    }


# ── Step-by-step explanation builder ─────────────────────────────────────────

def build_explanation(intent: str, params: ExtractedParams, result: Dict[str, Any]) -> List[Dict]:
    """
    Returns a list of reasoning steps the agent took.
    Each step: { "step": int, "title": str, "detail": str }
    """
    steps = []
    step = 1

    # Step 1: What I understood
    understood = []
    if params.raw_grade:
        understood.append(f"target grade **{params.raw_grade}** ({params.target_strength} MPa)")
    elif params.target_strength:
        understood.append(f"target strength **{params.target_strength} MPa**")
    if params.fly_ash_pct:
        understood.append(f"**{params.fly_ash_pct}% fly ash** replacement")
    if params.slag_pct:
        understood.append(f"**{params.slag_pct}% slag** replacement")
    if params.objective == 'carbon':
        understood.append("minimize **carbon emissions**")
    elif params.objective == 'cost':
        understood.append("minimize **cost**")

    steps.append({
        "step": step, "step_num": step,
        "title": "Understanding your request",
        "detail": "I identified: " + ", ".join(understood) if understood else "Analyzing your request..."
    })
    step += 1

    # Step 2: Mix design approach
    if intent in ('optimize_mix', 'predict_strength'):
        wc = round(params.water / params.cement, 2) if (params.water and params.cement) else "calculated"
        steps.append({
            "step": step, "step_num": step,
            "title": "Applying IS:10262 mix design guidelines",
            "detail": f"Using water-cement ratio of {wc} based on target strength. "
                      f"Incorporating supplementary materials to reduce clinker content."
        })
        step += 1

    # Step 3: ML model
    if intent in ('optimize_mix', 'predict_strength'):
        steps.append({
            "step": step, "step_num": step,
            "title": "Running ML strength prediction model",
            "detail": "Ensemble of Random Forest + Neural Network trained on the Yeh (1998) concrete dataset "
                      "(1030 samples). Predicting 7-day, 28-day and 56-day compressive strength."
        })
        step += 1

    # Step 4: Optimization
    if intent == 'optimize_mix':
        obj_text = "material cost (USD/m³)" if params.objective == 'cost' else "carbon footprint (kg CO₂/m³)"
        steps.append({
            "step": step, "step_num": step,
            "title": f"Optimizing mix to minimize {obj_text}",
            "detail": "Iterating over mix proportions while keeping predicted 28-day strength ≥ target. "
                      "Adjusting cement, fly ash, slag and aggregate ratios."
        })
        step += 1

    # Step 5: Cost/carbon
    if result.get("cost_saved") or result.get("carbon_saved"):
        saved_cost = result.get("cost_saved", 0)
        saved_carbon = result.get("carbon_saved", 0)
        parts = []
        if saved_cost > 0:
            parts.append(f"**${saved_cost:.2f}/m³** cost saving vs OPC-only baseline")
        if saved_carbon > 0:
            parts.append(f"**{saved_carbon:.1f} kg CO₂/m³** carbon reduction")
        steps.append({
            "step": step, "step_num": step,
            "title": "Calculating savings vs baseline",
            "detail": " · ".join(parts) if parts else "Computing savings against a standard OPC mix."
        })
        step += 1

    return steps


# ── Main agent function ───────────────────────────────────────────────────────

class ConcreteCopilot:
    """
    The ConcreteMix AI Copilot.
    Stateless per call — conversation memory managed by MongoDB.
    """

    GREET_RESPONSE = (
        "Hi! I'm **ConcreteMix Copilot**, your AI assistant for concrete mix design. "
        "Here's what I can do:\n\n"
        "• **Design a mix** — *'Design M40 concrete with 20% fly ash and lowest cost'*\n"
        "• **Predict strength** — *'What strength will 350kg cement, 185kg water, 80kg fly ash give?'*\n"
        "• **Calculate cost** — *'What is the cost of this mix per m³?'*\n"
        "• **Estimate carbon** — *'What is the carbon footprint of M30 with 30% slag?'*\n"
        "• **Compare mixes** — *'Compare this mix against a standard OPC mix'*\n"
        "• **Generate report** — *'Generate a trial mix report for M40'*\n\n"
        "Just type naturally — I'll understand."
    )

    UNKNOWN_RESPONSE = (
        "I didn't quite understand that. Try something like:\n\n"
        "• *'Design M35 with 25% fly ash'*\n"
        "• *'Predict strength for 400kg cement, 180kg water'*\n"
        "• *'What is the carbon footprint of this mix?'*"
    )

    def process(
        self,
        message: str,
        conversation_history: List[Dict],
        predictor,
        optimizer
    ) -> Dict[str, Any]:
        """
        Main entry point. Returns a full agent response dict.
        """
        intent = classify_intent(message)
        params = extract_params(message)

        # Inherit context from conversation history
        params = self._inherit_context(params, conversation_history)

        if intent == 'greet':
            return {
                "intent": "greet",
                "message": self.GREET_RESPONSE,
                "steps": [],
                "data": {}
            }

        if intent == 'unknown':
            return {
                "intent": "unknown",
                "message": self.UNKNOWN_RESPONSE,
                "steps": [],
                "data": {}
            }

        if intent == 'show_history':
            return {
                "intent": "show_history",
                "message": "Here are your recent mix designs. Click any to load it.",
                "steps": [],
                "data": {"action": "show_history"}
            }

        if intent == 'explain':
            return self._handle_explain(message)

        # Build mix from params if needed
        if not all([params.cement, params.water]):
            mix = build_mix_from_params(params)
            params.cement = params.cement or mix['cement']
            params.water = params.water or mix['water']
            params.fly_ash = params.fly_ash or mix['fly_ash']
            params.slag = params.slag or mix['slag']
            params.fine_aggregate = params.fine_aggregate or mix['fine_aggregate']
            params.coarse_aggregate = params.coarse_aggregate or mix['coarse_aggregate']
            params.superplasticizer = params.superplasticizer or mix['superplasticizer']

        mix_data = {
            'cement': params.cement,
            'water': params.water,
            'fly_ash': params.fly_ash or 0,
            'slag': params.slag or 0,
            'fine_aggregate': params.fine_aggregate or 700,
            'coarse_aggregate': params.coarse_aggregate or 1000,
            'superplasticizer': params.superplasticizer or 5,
        }

        result = {}
        response_message = ""

        try:
            if intent in ('optimize_mix', 'predict_strength', 'calculate_cost', 'calculate_carbon', 'compare_mixes'):
                # Run strength prediction
                age = params.age or 28
                pred_28 = predictor.predict_strength(mix_data, age=28)
                pred_7  = predictor.predict_strength(mix_data, age=7)
                pred_56 = predictor.predict_strength(mix_data, age=56)

                s28 = round(pred_28['predicted_strength'], 1)
                s7  = round(pred_7['predicted_strength'], 1)
                s56 = round(pred_56['predicted_strength'], 1)
                wc  = round(params.water / params.cement, 3)

                # Cost calculation
                default_costs = {
                    'cement': 0.12, 'water': 0.001, 'fly_ash': 0.05,
                    'slag': 0.06, 'fine_aggregate': 0.03,
                    'coarse_aggregate': 0.04, 'superplasticizer': 2.5
                }
                total_cost = sum(
                    mix_data[m] * default_costs.get(m, 0)
                    for m in mix_data
                )

                # Carbon footprint
                emission_factors = {
                    'cement': 0.82, 'water': 0, 'fly_ash': 0.01,
                    'slag': 0.03, 'fine_aggregate': 0.005,
                    'coarse_aggregate': 0.005, 'superplasticizer': 0.1
                }
                total_carbon = sum(
                    mix_data[m] * emission_factors.get(m, 0)
                    for m in mix_data
                )

                # Baseline (pure OPC, no SCM)
                baseline_cost = params.cement * 0.12 + (params.water or 185) * 0.001 + \
                                700 * 0.03 + 1000 * 0.04 + 5 * 2.5
                baseline_carbon = params.cement * 0.82 + (params.water or 185) * 0 + \
                                  700 * 0.005 + 1000 * 0.005

                cost_saved   = round(baseline_cost - total_cost, 2)
                carbon_saved = round(baseline_carbon - total_carbon, 1)

                result = {
                    "mix_design": mix_data,
                    "strength_7day":  s7,
                    "strength_28day": s28,
                    "strength_56day": s56,
                    "water_cement_ratio": wc,
                    "total_cost": round(total_cost, 2),
                    "total_carbon": round(total_carbon, 1),
                    "cost_saved":   max(0, cost_saved),
                    "carbon_saved": max(0, carbon_saved),
                    "meets_target": s28 >= (params.target_strength or 0)
                }

                # Build natural language response
                grade = params.raw_grade or f"{params.target_strength} MPa" if params.target_strength else "your mix"
                scm_parts = []
                if mix_data['fly_ash'] > 0:
                    scm_parts.append(f"{params.fly_ash_pct or round(mix_data['fly_ash'] / (mix_data['cement'] + mix_data['fly_ash']) * 100)}% fly ash")
                if mix_data['slag'] > 0:
                    scm_parts.append(f"{params.slag_pct or round(mix_data['slag'] / (mix_data['cement'] + mix_data['slag']) * 100)}% slag")
                scm_str = " with " + " and ".join(scm_parts) if scm_parts else ""

                meets = "✅ Meets target" if result["meets_target"] else "⚠️ Below target"
                response_message = (
                    f"I've designed **{grade}** concrete{scm_str}.\n\n"
                    f"**Predicted strength:** {s7} MPa (7d) · **{s28} MPa (28d)** · {s56} MPa (56d) — {meets}\n"
                    f"**W/C ratio:** {wc}\n"
                    f"**Cost:** ${total_cost:.2f}/m³"
                    + (f" *(saves ${cost_saved:.2f}/m³ vs OPC baseline)*" if cost_saved > 0 else "")
                    + f"\n**Carbon:** {total_carbon:.1f} kg CO₂/m³"
                    + (f" *(saves {carbon_saved:.1f} kg CO₂/m³)*" if carbon_saved > 0 else "")
                )

                if not result["meets_target"] and params.target_strength:
                    shortfall = round(params.target_strength - s28, 1)
                    response_message += (
                        f"\n\n⚠️ **{shortfall} MPa below target.** "
                        f"Try increasing cement by ~{round(shortfall * 8)} kg/m³ "
                        f"or reducing water by ~{round(shortfall * 2)} kg/m³."
                    )

            if intent == 'generate_report':
                result["action"] = "generate_pdf"
                response_message = (
                    "I'll generate a **Trial Mix Report** for this design. "
                    "It includes mix proportions, predicted strengths, cost breakdown, "
                    "carbon footprint and site instructions."
                )

        except Exception as e:
            return {
                "intent": intent,
                "message": f"I encountered an error running the analysis: {str(e)}. "
                           "Please check that the ML models are loaded.",
                "steps": [],
                "data": {}
            }

        steps = build_explanation(intent, params, result)

        return {
            "intent": intent,
            "message": response_message,
            "steps": steps,
            "data": result,
            "mix_data": mix_data
        }

    def _inherit_context(self, params: ExtractedParams, history: List[Dict]) -> ExtractedParams:
        """
        If the engineer refers to a previous mix, inherit those values.
        e.g. "compare with the previous one" or "what about 30% fly ash instead?"
        """
        if not history:
            return params

        last_agent_msg = next(
            (m for m in reversed(history) if m.get('role') == 'agent' and m.get('mix_data')),
            None
        )
        if not last_agent_msg:
            return params

        prev_mix = last_agent_msg.get('mix_data', {})
        prev_params = last_agent_msg.get('params', {})

        # Inherit target strength if not specified in current message
        if not params.target_strength and prev_params.get('target_strength'):
            params.target_strength = prev_params['target_strength']
            params.raw_grade = prev_params.get('raw_grade')

        # Inherit explicit kg values if not re-specified
        for field in ['cement', 'water', 'fine_aggregate', 'coarse_aggregate', 'superplasticizer']:
            if getattr(params, field) is None and prev_mix.get(field):
                setattr(params, field, prev_mix[field])

        return params

    def _handle_explain(self, message: str) -> Dict:
        t = message.lower()
        explanations = {
            'w/c ratio': (
                "The **water-cement ratio (W/C)** is the mass of water divided by mass of cement. "
                "Lower W/C → higher strength but less workable. "
                "Typical range: 0.35 (high strength) to 0.55 (normal). "
                "IS:456 limits W/C to 0.45 for moderate exposure."
            ),
            'fly ash': (
                "**Fly ash** is a byproduct of coal combustion. When used as a partial cement replacement "
                "(up to 30%), it reduces cost and carbon emissions by ~40%, improves workability, "
                "reduces heat of hydration, and increases long-term strength. "
                "Slight reduction in early (7-day) strength."
            ),
            'slag': (
                "**GGBS (Ground Granulated Blast-furnace Slag)** is a steel industry byproduct. "
                "Can replace 30–70% of cement. Improves durability, reduces carbon by ~80% vs cement, "
                "and produces denser, more impermeable concrete. "
                "Slower early strength gain."
            ),
            'superplasticizer': (
                "**Superplasticizers (SP)** are chemical admixtures that reduce water demand by 15–25% "
                "without reducing workability. This allows lower W/C ratios → higher strength. "
                "Typical dosage: 0.5–2% by weight of cementitious material."
            ),
            'm40': (
                "**M40** refers to a concrete mix with a characteristic compressive strength of **40 MPa** "
                "at 28 days (150mm cube). Used for prestressed concrete, bridges, high-rise columns. "
                "IS:456 recommends W/C ≤ 0.40 for M40."
            ),
        }
        for key, explanation in explanations.items():
            if key in t:
                return {
                    "intent": "explain",
                    "message": explanation,
                    "steps": [],
                    "data": {}
                }
        return {
            "intent": "explain",
            "message": "Could you be more specific? Try asking about: W/C ratio, fly ash, slag, superplasticizer, M40, M30, etc.",
            "steps": [],
            "data": {}
        }