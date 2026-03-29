import { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Spinner } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const COLORS = ['#FF5E00', '#0A0A0A', '#71717A', '#F4F4F5', '#E4E4E7', '#A1A1AA', '#D4D4D8'];

export const CostCalculator = () => {
  const [mixProportions, setMixProportions] = useState({
    cement: '',
    water: '',
    fly_ash: '',
    slag: '',
    fine_aggregate: '',
    coarse_aggregate: '',
    superplasticizer: ''
  });
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

  const handleMixChange = (material, value) => {
    setMixProportions({ ...mixProportions, [material]: value });
  };

  const handleCostChange = (material, value) => {
    setMaterialCosts({ ...materialCosts, [material]: value });
  };

  const handleCalculate = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const mix = {};
      const costs = {};
      
      Object.keys(mixProportions).forEach(key => {
        mix[key] = parseFloat(mixProportions[key]);
      });
      
      Object.keys(materialCosts).forEach(key => {
        costs[key] = parseFloat(materialCosts[key]);
      });

      const { data } = await axios.post(
        `${API_URL}/api/calculate-cost`,
        {
          mix_proportions: mix,
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

  const pieData = result ? Object.entries(result.cost_breakdown).map(([key, value], index) => ({
    name: key.replace('_', ' ').toUpperCase(),
    value: value,
    color: COLORS[index % COLORS.length]
  })) : [];

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="border border-border p-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight mb-6">Mix & Cost Input</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-heading text-sm font-bold mb-3 uppercase tracking-[0.2em]">Mix Proportions (kg/m³)</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(mixProportions).map(([material, value]) => (
                <div key={material} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {material.replace('_', ' ').toUpperCase()}
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={value}
                    onChange={(e) => handleMixChange(material, e.target.value)}
                    className="font-mono text-sm"
                    placeholder="0"
                    data-testid={`mix-${material}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="font-heading text-sm font-bold mb-3 uppercase tracking-[0.2em]">Material Costs (USD/kg)</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(materialCosts).map(([material, value]) => (
                <div key={material} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {material.replace('_', ' ').toUpperCase()}
                  </Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={value}
                    onChange={(e) => handleCostChange(material, e.target.value)}
                    className="font-mono text-sm"
                    data-testid={`cost-calc-${material}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm" data-testid="cost-error">
              {error}
            </div>
          )}

          <Button 
            onClick={handleCalculate} 
            className="w-full" 
            disabled={loading}
            data-testid="calculate-cost-button"
          >
            {loading ? (
              <><Spinner size={20} className="mr-2 animate-spin" /> Calculating...</>
            ) : (
              'Calculate Cost'
            )}
          </Button>
        </div>
      </div>

      <div className="border border-border p-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight mb-6">Cost Analysis</h2>
        
        {!result && (
          <div className="h-full flex items-center justify-center text-center text-muted-foreground">
            <p>Enter mix proportions and costs to calculate total cost</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="p-6 border border-border bg-primary/5 text-center">
              <p className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2">Total Cost</p>
              <p className="font-mono text-5xl font-black text-primary" data-testid="total-cost-result">${result.total_cost_per_m3}</p>
              <p className="text-sm text-muted-foreground mt-2">per cubic meter</p>
            </div>

            <div className="border border-border p-4">
              <p className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground mb-3">Cost Breakdown</p>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      border: '1px solid #E4E4E7',
                      borderRadius: '2px',
                      fontFamily: 'JetBrains Mono'
                    }}
                    formatter={(value) => `$${value.toFixed(2)}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="border border-border">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground">
                    <th className="text-left p-3">Material</th>
                    <th className="text-right p-3">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-sm">
                  {Object.entries(result.cost_breakdown).map(([material, cost]) => (
                    <tr key={material} className="border-b border-border last:border-0">
                      <td className="p-3">{material.replace('_', ' ').toUpperCase()}</td>
                      <td className="text-right p-3" data-testid={`breakdown-${material}`}>${cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};