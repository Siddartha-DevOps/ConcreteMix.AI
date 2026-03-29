import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import os

class ConcreteDataLoader:
    def __init__(self):
        self.scaler = StandardScaler()
        self.df = None
        
    def load_uci_concrete_data(self):
        """Load UCI Concrete Compressive Strength Dataset"""
        
        # Create sample dataset based on UCI Concrete data characteristics
        # In production, download from: https://archive.ics.uci.edu/ml/datasets/Concrete+Compressive+Strength
        
        np.random.seed(42)
        n_samples = 1030
        
        # Generate realistic concrete mix data
        data = {
            'cement': np.random.uniform(102, 540, n_samples),
            'slag': np.random.uniform(0, 359.4, n_samples),
            'fly_ash': np.random.uniform(0, 200, n_samples),
            'water': np.random.uniform(121.8, 247, n_samples),
            'superplasticizer': np.random.uniform(0, 32.2, n_samples),
            'coarse_aggregate': np.random.uniform(801, 1145, n_samples),
            'fine_aggregate': np.random.uniform(594, 992.6, n_samples),
            'age': np.random.choice([1, 3, 7, 14, 28, 56, 90, 365], n_samples)
        }
        
        self.df = pd.DataFrame(data)
        
        # Calculate compressive strength with realistic formula
        self.df['compressive_strength'] = (
            0.5 * self.df['cement'] +
            0.3 * self.df['slag'] +
            0.2 * self.df['fly_ash'] -
            0.4 * self.df['water'] +
            2.0 * self.df['superplasticizer'] +
            0.1 * self.df['coarse_aggregate'] +
            0.05 * self.df['fine_aggregate'] +
            np.log1p(self.df['age']) * 5
        ) / 10
        
        # Add realistic noise
        self.df['compressive_strength'] += np.random.normal(0, 5, n_samples)
        self.df['compressive_strength'] = np.clip(self.df['compressive_strength'], 2, 82)
        
        return self.df
    
    def prepare_data(self, target_age=28):
        """Prepare data for training"""
        if self.df is None:
            self.load_uci_concrete_data()
        
        # Filter by age if needed
        df_filtered = self.df[self.df['age'] == target_age].copy()
        
        X = df_filtered.drop('compressive_strength', axis=1)
        y = df_filtered['compressive_strength']
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        return X_train_scaled, X_test_scaled, y_train, y_test, X_train.columns
    
    def get_full_dataset(self):
        """Get complete dataset"""
        if self.df is None:
            self.load_uci_concrete_data()
        return self.df
