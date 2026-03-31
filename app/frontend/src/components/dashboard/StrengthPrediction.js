import { useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const StrengthPrediction = () => {
  const [inputs, setInputs] = useState({
    cement: '',
    water: '',
    fly_ash: '',
    slag: '',
    fine_aggregate: '',
    coarse_aggregate: '',
    superplasticizer: '',
    age: '28',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const handlePredict = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const payload = {};
      Object.keys(inputs).forEach((k) => {
        payload[k] = parseFloat(inputs[k]);
      });
      const { data } = await axios.post(
        `${API_URL}/api/predict-strength`,
        payload,
        { withCredentials: true }
      );
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const chartData = result
    ? [
        { day: '7d', strength: result.strength_7day },
        { day: '28d', strength: result.strength_28day },
        { day: '56d', strength: result.strength_56day },
      ]
    : [];

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="border border-border p-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight mb-6">Mix Proportions</h2>

        <div className="grid grid-cols-2 gap-4">
          {Object.entries(inputs).map(([key, val]) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground">
                {key.replace(/_/g, ' ')}
                {key !== 'age' ? ' (kg/m³)' : ' (days)'}
              </Label>
              <Input
                name={key}
                type="number"
                step="0.1"
                value={val}
                onChange={handleChange}
                className="font-mono"
                placeholder={key === 'age' ? '28' : '0'}
                data-testid={`input-${key}`}
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <Button
          onClick={handlePredict}
          className="w-full mt-6"
          disabled={loading}
          data-testid="predict-button"
        >
          {loading ? 'Predicting...' : 'Predict Strength'}
        </Button>
      </div>

      <div className="border border-border p-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight mb-6">Predicted Strength</h2>

        {!result && (
          <div className="h-full flex items-center justify-center text-muted-foreground text-center">
            <p>Enter mix proportions and click predict to see results</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '7-Day', val: result.strength_7day, testid: 'strength-7day' },
                { label: '28-Day', val: result.strength_28day, testid: 'strength-28day' },
                { label: '56-Day', val: result.strength_56day, testid: 'strength-56day' },
              ].map(({ label, val, testid }) => (
                <div key={label} className="p-4 border border-border text-center">
                  <p className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground mb-1">{label}</p>
                  <p className="font-mono text-2xl font-bold text-primary" data-testid={testid}>
                    {val}
                  </p>
                  <p className="text-xs text-muted-foreground">MPa</p>
                </div>
              ))}
            </div>

            <div className="border border-border p-4">
              <p className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground mb-3">
                Strength Over Time
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                  <XAxis dataKey="day" className="font-mono text-xs" />
                  <YAxis className="font-mono text-xs" />
                  <Tooltip
                    contentStyle={{
                      border: '1px solid #E4E4E7',
                      borderRadius: '2px',
                      fontFamily: 'JetBrains Mono',
                    }}
                    formatter={(v) => [`${v} MPa`, 'Strength']}
                  />
                  <Line
                    type="monotone"
                    dataKey="strength"
                    stroke="#FF5E00"
                    strokeWidth={2}
                    dot={{ fill: '#FF5E00', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {result.water_cement_ratio && (
              <div className="p-4 border border-border bg-muted/30 text-sm">
                <span className="font-bold">W/C Ratio: </span>
                <span className="font-mono" data-testid="wc-ratio">{result.water_cement_ratio}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};