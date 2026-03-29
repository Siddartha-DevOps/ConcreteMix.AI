import { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner, Leaf, Warning } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const CarbonCalculator = () => {
  const [mixProportions, setMixProportions] = useState({
    cement: '',
    water: '',
    fly_ash: '',
    slag: '',
    fine_aggregate: '',
    coarse_aggregate: '',
    superplasticizer: ''
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (material, value) => {
    setMixProportions({ ...mixProportions, [material]: value });
  };

  const handleCalculate = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const mix = {};
      Object.keys(mixProportions).forEach(key => {
        mix[key] = parseFloat(mixProportions[key]);
      });

      const { data } = await axios.post(
        `${API_URL}/api/calculate-carbon`,
        mix,
        { withCredentials: true }
      );

      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="border border-border p-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight mb-6">Mix Proportions</h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(mixProportions).map(([material, value]) => (
              <div key={material} className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-[0.2em]">
                  {material.replace('_', ' ')}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={value}
                  onChange={(e) => handleChange(material, e.target.value)}
                  className="font-mono text-sm"
                  placeholder="kg/m³"
                  data-testid={`carbon-${material}`}
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm" data-testid="carbon-error">
              {error}
            </div>
          )}

          <Button 
            onClick={handleCalculate} 
            className="w-full" 
            disabled={loading}
            data-testid="calculate-carbon-button"
          >
            {loading ? (
              <><Spinner size={20} className="mr-2 animate-spin" /> Calculating...</>
            ) : (
              <><Leaf size={20} className="mr-2" /> Calculate Carbon Footprint</>
            )}
          </Button>
        </div>
      </div>

      <div className="border border-border p-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight mb-6">Carbon Footprint Analysis</h2>
        
        {!result && (
          <div className="h-full flex items-center justify-center text-center text-muted-foreground">
            <p>Enter mix proportions to calculate carbon emissions</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="p-6 border border-border bg-green-50 text-center">
              <Leaf size={48} className="mx-auto mb-3 text-green-600" weight="fill" />
              <p className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2">Total Carbon Footprint</p>
              <p className="font-mono text-5xl font-black text-green-600" data-testid="carbon-result">{result.total_carbon_footprint}</p>
              <p className="text-sm text-muted-foreground mt-2">{result.unit}</p>
            </div>

            {result.reduction_suggestions && result.reduction_suggestions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Warning size={20} className="text-primary" weight="fill" />
                  <p className="text-xs uppercase tracking-[0.2em] font-bold">Reduction Strategies</p>
                </div>
                
                {result.reduction_suggestions.map((suggestion, index) => (
                  <div 
                    key={index} 
                    className="p-4 border border-border hover:border-primary transition-colors"
                    data-testid={`suggestion-${index}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="font-mono text-sm font-bold text-primary">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm mb-1">{suggestion.action}</p>
                        <p className="text-xs text-green-600 font-mono mb-2">{suggestion.impact}</p>
                        <p className="text-xs text-muted-foreground">{suggestion.recommendation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 border border-border bg-muted/30">
              <p className="text-xs font-bold mb-2">Carbon Emission Factors Used:</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-muted-foreground">
                <div>Cement: 0.82 kg CO₂/kg</div>
                <div>Fly Ash: 0.01 kg CO₂/kg</div>
                <div>Slag: 0.03 kg CO₂/kg</div>
                <div>Aggregates: 0.005 kg CO₂/kg</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
