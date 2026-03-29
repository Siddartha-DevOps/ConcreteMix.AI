import minimize, differental_evolution
from scipy.optimize import minimize, differential_evolution
import random

class MixOptimizer:
    def __init__(self, strength_predictor):
        self.predictor = strength_predictor
        
    def calculate_cost(self, mix_proportions, material_costs):
        """Calculate total cost per cubic meter"""
        cost = (
            mix_proportions['cement'] * material_costs.get('cement', 0.12) +
            mix_proportions['water'] * material_costs.get('water', 0.001) +
            mix_proportions['fly_ash'] * material_costs.get('fly_ash', 0.05) +
            mix_proportions['slag'] * material_costs.get('slag', 0.06) +
            mix_proportions['fine_aggregate'] * material_costs.get('fine_aggregate', 0.03) +
            mix_proportions['coarse_aggregate'] * material_costs.get('coarse_aggregate', 0.04) +
            mix_proportions['superplasticizer'] * material_costs.get('superplasticizer', 2.5)
        )
        return cost
    
    def calculate_carbon_footprint(self, mix_proportions):
        """Calculate CO2 emissions in kg per cubic meter"""
        # Carbon emission factors (kg CO2 per kg material)
        carbon_factors = {
            'cement': 0.82,
            'fly_ash': 0.01,
            'slag': 0.03,
            'water': 0.0001,
            'fine_aggregate': 0.005,
            'coarse_aggregate': 0.005,
            'superplasticizer': 0.15
        }
        
        total_carbon = (
            mix_proportions['cement'] * carbon_factors['cement'] +
            mix_proportions['fly_ash'] * carbon_factors['fly_ash'] +
            mix_proportions['slag'] * carbon_factors['slag'] +
            mix_proportions['water'] * carbon_factors['water'] +
            mix_proportions['fine_aggregate'] * carbon_factors['fine_aggregate'] +
            mix_proportions['coarse_aggregate'] * carbon_factors['coarse_aggregate'] +
            mix_proportions['superplasticizer'] * carbon_factors['superplasticizer']
        )
        
        return total_carbon
    
    def optimize_mix_design(self, target_strength, material_costs, constraints=None):
        """Optimize mix design using genetic algorithm"""
        
        def objective_function(x):
            """Minimize cost while meeting strength target"""
            mix_data = {
                'cement': x[0],
                'slag': x[1],
                'fly_ash': x[2],
                'water': x[3],
                'superplasticizer': x[4],
                'coarse_aggregate': x[5],
                'fine_aggregate': x[6]
            }
            
            # Predict strength at 28 days
            prediction = self.predictor.predict_strength(mix_data, age=28)
            predicted_strength = prediction['predicted_strength']
            
            # Calculate cost
            cost = self.calculate_cost(mix_data, material_costs)
            
            # Penalty if strength is below target
            strength_penalty = max(0, (target_strength - predicted_strength) * 1000)
            
            return cost + strength_penalty
        
        # Define bounds for each material (kg per m³)
        bounds = [
            (150, 500),    # cement
            (0, 300),      # slag
            (0, 200),      # fly_ash
            (120, 220),    # water
            (0, 15),       # superplasticizer
            (800, 1200),   # coarse_aggregate
            (600, 1000)    # fine_aggregate
        ]
        
        # Run optimization
        result = differential_evolution(
            objective_function,
            bounds,
            maxiter=100,
            seed=42,
            workers=1
        )
        
        optimized_mix = {
            'cement': round(result.x[0], 2),
            'slag': round(result.x[1], 2),
            'fly_ash': round(result.x[2], 2),
            'water': round(result.x[3], 2),
            'superplasticizer': round(result.x[4], 2),
            'coarse_aggregate': round(result.x[5], 2),
            'fine_aggregate': round(result.x[6], 2)
        }
        
        # Get predictions for optimized mix
        prediction_7d = self.predictor.predict_strength(optimized_mix, age=7)
        prediction_28d = self.predictor.predict_strength(optimized_mix, age=28)
        prediction_56d = self.predictor.predict_strength(optimized_mix, age=56)
        
        cost = self.calculate_cost(optimized_mix, material_costs)
        carbon = self.calculate_carbon_footprint(optimized_mix)
        
        return {
            'optimized_mix': optimized_mix,
            'predicted_strengths': {
                '7_day': round(prediction_7d['predicted_strength'], 2),
                '28_day': round(prediction_28d['predicted_strength'], 2),
                '56_day': round(prediction_56d['predicted_strength'], 2)
            },
            'total_cost': round(cost, 2),
            'carbon_footprint': round(carbon, 2),
            'water_cement_ratio': round(optimized_mix['water'] / optimized_mix['cement'], 3)
        }
    
    def suggest_carbon_reduction(self, mix_proportions):
        """Suggest alternatives to reduce carbon footprint"""
        suggestions = []
        
        if mix_proportions['cement'] > 300:
            suggestions.append({
                'action': 'Reduce cement content by 15%',
                'impact': 'Reduces CO₂ emissions by ~12%',
                'recommendation': f"Replace {round(mix_proportions['cement'] * 0.15, 1)}kg cement with slag or fly ash"
            })
        
        if mix_proportions['fly_ash'] < 50:
            suggestions.append({
                'action': 'Increase fly ash content',
                'impact': 'Reduces CO₂ emissions by ~8%',
                'recommendation': 'Add 50-80kg fly ash to replace equivalent cement'
            })
        
        if mix_proportions['slag'] < 100:
            suggestions.append({
                'action': 'Increase slag content',
                'impact': 'Reduces CO₂ emissions by ~10%',
                'recommendation': 'Add 100-150kg slag to replace equivalent cement'
            })
        
        return suggestions

