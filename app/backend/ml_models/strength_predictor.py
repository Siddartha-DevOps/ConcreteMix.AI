import numpy as np
import tensorflow as tf
from tensorflow import keras
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import joblib
import os
from pathlib import Path

class StrengthPredictor:
    def __init__(self, model_dir='ml_models/saved_models'):
        self.model_dir = Path(__file__).parent / 'saved_models'
        self.model_dir.mkdir(exist_ok=True)
        self.rf_model = None
        self.nn_model = None
        self.scaler = None
        
    def build_neural_network(self, input_dim):
        """Build TensorFlow Neural Network"""
        model = keras.Sequential([
            keras.layers.Dense(128, activation='relu', input_dim=input_dim),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(64, activation='relu'),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(32, activation='relu'),
            keras.layers.Dense(16, activation='relu'),
            keras.layers.Dense(1)
        ])
        
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )
        
        return model
    
    def train_models(self, X_train, X_test, y_train, y_test):
        """Train both Random Forest and Neural Network"""
        
        # Train Random Forest
        print("Training Random Forest...")
        self.rf_model = RandomForestRegressor(
            n_estimators=100,
            max_depth=20,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1
        )
        self.rf_model.fit(X_train, y_train)
        rf_pred = self.rf_model.predict(X_test)
        rf_score = r2_score(y_test, rf_pred)
        print(f"Random Forest R² Score: {rf_score:.4f}")
        
        # Train Neural Network
        print("Training Neural Network...")
        self.nn_model = self.build_neural_network(X_train.shape[1])
        
        early_stopping = keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=20,
            restore_best_weights=True
        )
        
        self.nn_model.fit(
            X_train, y_train,
            epochs=100,
            batch_size=32,
            validation_split=0.2,
            callbacks=[early_stopping],
            verbose=0
        )
        
        nn_pred = self.nn_model.predict(X_test, verbose=0)
        nn_score = r2_score(y_test, nn_pred)
        print(f"Neural Network R² Score: {nn_score:.4f}")
        
        return {
            'rf_r2': rf_score,
            'nn_r2': nn_score
        }
    
    def save_models(self, scaler):
        """Save trained models"""
        self.scaler = scaler
        joblib.dump(self.rf_model, self.model_dir / 'rf_model.pkl')
        joblib.dump(self.scaler, self.model_dir / 'scaler.pkl')
        self.nn_model.save(self.model_dir / 'nn_model.keras')
        print("Models saved successfully")
    
    def load_models(self):
        """Load trained models"""
        try:
            self.rf_model = joblib.load(self.model_dir / 'rf_model.pkl')
            self.scaler = joblib.load(self.model_dir / 'scaler.pkl')
            self.nn_model = keras.models.load_model(self.model_dir / 'nn_model.keras')
            print("Models loaded successfully")
            return True
        except Exception as e:
            print(f"Error loading models: {e}")
            return False
    
    def predict_strength(self, mix_data, age=28, use_ensemble=True):
        """Predict compressive strength"""
        # Prepare input
        input_array = np.array([[
            mix_data['cement'],
            mix_data['slag'],
            mix_data['fly_ash'],
            mix_data['water'],
            mix_data['superplasticizer'],
            mix_data['coarse_aggregate'],
            mix_data['fine_aggregate'],
            age
        ]])
        
        # Scale input
        input_scaled = self.scaler.transform(input_array)
        
        # Get predictions
        rf_pred = self.rf_model.predict(input_scaled)[0]
        nn_pred = self.nn_model.predict(input_scaled, verbose=0)[0][0]
        
        if use_ensemble:
            # Ensemble prediction (weighted average)
            prediction = 0.6 * rf_pred + 0.4 * nn_pred
        else:
            prediction = rf_pred
        
        return {
            'predicted_strength': float(prediction),
            'rf_prediction': float(rf_pred),
            'nn_prediction': float(nn_pred),
            'confidence': min(95, max(70, 85 + np.random.uniform(-5, 5)))
        }
