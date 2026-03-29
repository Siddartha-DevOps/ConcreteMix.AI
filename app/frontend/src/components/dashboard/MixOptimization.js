"import { useState } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Spinner, Lightbulb } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const MixOptimization = () => {
  const [targetStrength, setTargetStrength] = useState('');
  const [materialCosts, setMaterialCosts] = useState({
    cement: '0.12',
    water: '0.001',
    fly_ash: '0.05',
    slag: '0.06',
    fine_aggregate: '0.03',
    coarse_aggregate: '0.04',
    superplasticizer: '2.5'
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCostChange = (material, value) => {
    setMaterialCosts({ ...materialCosts, [material]: value });
  };

  const handleOptimize = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const costs = {};
      Object.keys(materialCosts).forEach(key => {
        costs[key] = parseFloat(materialCosts[key]);
      });

      const { data } = await axios.post(
        `${API_URL}/api/optimize-mix`,
        {
          target_strength: parseFloat(targetStrength),
          material_costs: costs
        },
        { withCredentials: true }
      );

      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const mixChartData = result ? Object.entries(result.optimized_mix).map(([key, value]) => ({
    material: key.replace('_', ' ').toUpperCase(),
    quantity: value
  })) : [];

  return (
    <div className=\"grid lg:grid-cols-2 gap-6\">
      <div className=\"border border-border p-6\">
        <h2 className=\"font-heading text-2xl font-bold tracking-tight mb-6\">Optimization Parameters</h2>
        
        <div className=\"space-y-6\">
          <div className=\"space-y-2\">
            <Label htmlFor=\"target_strength\" className=\"text-xs uppercase tracking-[0.2em] font-bold\">Target Strength (MPa)</Label>
            <Input
              id=\"target_strength\"
              type=\"number\"
              step=\"0.1\"
              value={targetStrength}
              onChange={(e) => setTargetStrength(e.target.value)}
              required
              className=\"font-mono text-lg\"
              placeholder=\"30\"
              data-testid=\"input-target-strength\"
            />
          </div>

          <div className=\"border-t border-border pt-4\">
            <h3 className=\"font-heading text-sm font-bold mb-4 uppercase tracking-[0.2em]\">Material Costs (USD/kg)</h3>
            
            <div className=\"grid grid-cols-2 gap-3\">
              {Object.entries(materialCosts).map(([material, value]) => (
                <div key={material} className=\"space-y-1\">
                  <Label className=\"text-xs text-muted-foreground\">
                    {material.replace('_', ' ').toUpperCase()}
                  </Label>
                  <Input
                    type=\"number\"
                    step=\"0.001\"
                    value={value}
                    onChange={(e) => handleCostChange(material, e.target.value)}
                    className=\"font-mono text-sm\"
                    data-testid={`cost-${material}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className=\"p-3 bg-destructive/10 border border-destructive text-destructive text-sm\" data-testid=\"optimization-error\">
              {error}
            </div>
          )}

          <Button 
            onClick={handleOptimize} 
            className=\"w-full\" 
            disabled={loading || !targetStrength}
            data-testid=\"optimize-button\"
          >
            {loading ? (
              <><Spinner size={20} className=\"mr-2 animate-spin\" /> Optimizing...</>
            ) : (
              'Optimize Mix Design'
            )}
          </Button>
        </div>
      </div>

      <div className=\"border border-border p-6\">
        <h2 className=\"font-heading text-2xl font-bold tracking-tight mb-6\">Optimized Results</h2>
        
        {!result && (
          <div className=\"h-full flex items-center justify-center text-center text-muted-foreground\">
            <p>Set target strength and click optimize to see results</p>
          </div>
        )}

        {result && (
          <div className=\"space-y-6\">
            <div className=\"grid grid-cols-2 gap-4\">
              <div className=\"p-4 border border-border bg-primary/5\">
                <p className=\"text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground mb-1\">Total Cost</p>
                <p className=\"font-mono text-3xl font-bold text-primary\" data-testid=\"total-cost\">${result.total_cost}</p>
                <p className=\"text-xs text-muted-foreground mt-1\">per m³</p>
              </div>
              <div className=\"p-4 border border-border\">
                <p className=\"text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground mb-1\">Carbon</p>
                <p className=\"font-mono text-3xl font-bold\" data-testid=\"carbon-footprint\">{result.carbon_footprint}</p>
                <p className=\"text-xs text-muted-foreground mt-1\">kg CO₂/m³</p>
              </div>
            </div>

            <div className=\"border border-border p-4\">
              <p className=\"text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground mb-3\">Predicted Strengths</p>
              <div className=\"grid grid-cols-3 gap-3\">
                <div>
                  <p className=\"text-xs text-muted-foreground\">7 Days</p>
                  <p className=\"font-mono text-lg font-bold\" data-testid=\"opt-strength-7day\">{result.predicted_strengths['7_day']} MPa</p>
                </div>
                <div>
                  <p className=\"text-xs text-muted-foreground\">28 Days</p>
                  <p className=\"font-mono text-lg font-bold text-primary\" data-testid=\"opt-strength-28day\">{result.predicted_strengths['28_day']} MPa</p>
                </div>
                <div>
                  <p className=\"text-xs text-muted-foreground\">56 Days</p>
                  <p className=\"font-mono text-lg font-bold\" data-testid=\"opt-strength-56day\">{result.predicted_strengths['56_day']} MPa</p>
                </div>
              </div>
            </div>

            <div className=\"border border-border p-4\">
              <p className=\"text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground mb-3\">Mix Proportions (kg/m³)</p>
              <ResponsiveContainer width=\"100%\" height={200}>
                <BarChart data={mixChartData} layout=\"vertical\">
                  <CartesianGrid strokeDasharray=\"3 3\" stroke=\"#E4E4E7\" />
                  <XAxis type=\"number\" className=\"font-mono text-xs\" />
                  <YAxis dataKey=\"material\" type=\"category\" width={120} className=\"font-mono text-xs\" />
                  <Tooltip 
                    contentStyle={{ 
                      border: '1px solid #E4E4E7',
                      borderRadius: '2px',
                      fontFamily: 'JetBrains Mono'
                    }}
                  />
                  <Bar dataKey=\"quantity\" fill=\"#FF5E00\" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className=\"p-4 border border-border bg-muted/30\">
              <div className=\"flex items-start gap-2\">
                <Lightbulb size={20} className=\"text-primary mt-1\" weight=\"fill\" />
                <div>
                  <p className=\"font-bold text-sm mb-1\">Optimization Summary</p>
                  <p className=\"text-xs text-muted-foreground\">
                    Water-Cement Ratio: <span className=\"font-mono font-bold\">{result.water_cement_ratio}</span>
                  </p>
                  <p className=\"text-xs text-muted-foreground mt-1\">
                    This mix design meets your target strength of {targetStrength} MPa while minimizing cost.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};