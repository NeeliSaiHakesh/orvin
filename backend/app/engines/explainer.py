"""Explainable AI Engine for AutoMLOps.

Generates comprehensive model explanations including SHAP values,
feature importance, confusion matrices, ROC curves, and
precision-recall curves. All chart data is Plotly-compatible JSON.
"""
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import (
    confusion_matrix as sk_confusion_matrix,
    roc_curve, auc, precision_recall_curve,
    average_precision_score, roc_auc_score
)
from sklearn.preprocessing import label_binarize
import warnings

warnings.filterwarnings('ignore')


def explain_model(
    model,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    task_type: str,
) -> dict:
    """Generate comprehensive model explanation.
    
    Args:
        model: Trained sklearn-compatible model
        X_test: Test features DataFrame
        y_test: Test labels Series
        task_type: 'classification' or 'regression'
    
    Returns:
        Dictionary containing all explanation data in Plotly-compatible format
    """
    explanation = {}
    
    # ── SHAP Values ──
    try:
        # Sample data if too large
        max_samples = min(200, len(X_test))
        X_sample = X_test.iloc[:max_samples]
        
        # Try TreeExplainer first (fastest for tree models)
        try:
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X_sample)
        except Exception:
            # Fallback to KernelExplainer
            background = shap.sample(X_test, min(50, len(X_test)))
            explainer = shap.KernelExplainer(model.predict, background)
            shap_values = explainer.shap_values(X_sample)
        
        # Handle multi-class: shap_values is a list of arrays
        if isinstance(shap_values, list):
            # Use mean absolute across classes
            shap_abs = np.mean([np.abs(sv) for sv in shap_values], axis=0)
        else:
            shap_abs = np.abs(shap_values)
        
        # Feature importance from SHAP
        mean_shap = shap_abs.mean(axis=0)
        feature_names = X_test.columns.tolist()
        importance_dict = {}
        for fname, val in sorted(zip(feature_names, mean_shap), key=lambda x: x[1], reverse=True):
            importance_dict[fname] = round(float(val), 6)
        
        explanation['feature_importance'] = importance_dict
        
        # SHAP summary data for beeswarm plot
        if not isinstance(shap_values, list):
            shap_for_plot = shap_values
        else:
            shap_for_plot = shap_values[1] if len(shap_values) == 2 else shap_values[0]
        
        explanation['shap_summary'] = {
            'feature_names': feature_names,
            'shap_values': shap_for_plot.tolist() if hasattr(shap_for_plot, 'tolist') else shap_for_plot,
            'feature_values': X_sample.values.tolist(),
        }
        
    except Exception as e:
        # Fallback: use model's feature_importances_ if available
        explanation['shap_error'] = str(e)
        if hasattr(model, 'feature_importances_'):
            importances = model.feature_importances_
            feature_names = X_test.columns.tolist()
            explanation['feature_importance'] = {
                fname: round(float(val), 6)
                for fname, val in sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
            }
        else:
            explanation['feature_importance'] = {}
    
    # ── Classification-specific charts ──
    if task_type == 'classification':
        y_pred = model.predict(X_test)
        classes = sorted(y_test.unique())
        class_labels = [str(c) for c in classes]
        
        # Confusion Matrix
        cm = sk_confusion_matrix(y_test, y_pred, labels=classes)
        explanation['confusion_matrix'] = {
            'matrix': cm.tolist(),
            'labels': class_labels,
            'plotly': {
                'data': [{
                    'type': 'heatmap',
                    'z': cm.tolist(),
                    'x': class_labels,
                    'y': class_labels,
                    'colorscale': 'Blues',
                    'showscale': True,
                    'text': cm.tolist(),
                    'texttemplate': '%{text}',
                    'textfont': {'size': 14},
                }],
                'layout': {
                    'title': 'Confusion Matrix',
                    'xaxis': {'title': 'Predicted'},
                    'yaxis': {'title': 'Actual', 'autorange': 'reversed'},
                    'paper_bgcolor': 'rgba(0,0,0,0)',
                    'plot_bgcolor': 'rgba(0,0,0,0)',
                    'font': {'color': '#F9FAFB'},
                },
            }
        }
        
        # ROC Curve
        if hasattr(model, 'predict_proba'):
            y_proba = model.predict_proba(X_test)
            
            if len(classes) == 2:
                fpr, tpr, _ = roc_curve(y_test, y_proba[:, 1], pos_label=classes[1])
                roc_auc_val = auc(fpr, tpr)
                explanation['roc_curve'] = {
                    'plotly': {
                        'data': [
                            {
                                'type': 'scatter',
                                'x': fpr.tolist(),
                                'y': tpr.tolist(),
                                'mode': 'lines',
                                'name': f'ROC (AUC = {roc_auc_val:.3f})',
                                'line': {'color': '#8B5CF6', 'width': 2},
                            },
                            {
                                'type': 'scatter',
                                'x': [0, 1],
                                'y': [0, 1],
                                'mode': 'lines',
                                'name': 'Random',
                                'line': {'color': '#4B5563', 'dash': 'dash'},
                            }
                        ],
                        'layout': {
                            'title': 'ROC Curve',
                            'xaxis': {'title': 'False Positive Rate'},
                            'yaxis': {'title': 'True Positive Rate'},
                            'paper_bgcolor': 'rgba(0,0,0,0)',
                            'plot_bgcolor': 'rgba(0,0,0,0)',
                            'font': {'color': '#F9FAFB'},
                        },
                    }
                }
                
                # Precision-Recall Curve
                prec, rec, _ = precision_recall_curve(y_test, y_proba[:, 1], pos_label=classes[1])
                ap = average_precision_score(y_test, y_proba[:, 1], pos_label=classes[1])
                explanation['precision_recall'] = {
                    'plotly': {
                        'data': [{
                            'type': 'scatter',
                            'x': rec.tolist(),
                            'y': prec.tolist(),
                            'mode': 'lines',
                            'name': f'PR (AP = {ap:.3f})',
                            'line': {'color': '#06B6D4', 'width': 2},
                        }],
                        'layout': {
                            'title': 'Precision-Recall Curve',
                            'xaxis': {'title': 'Recall'},
                            'yaxis': {'title': 'Precision'},
                            'paper_bgcolor': 'rgba(0,0,0,0)',
                            'plot_bgcolor': 'rgba(0,0,0,0)',
                            'font': {'color': '#F9FAFB'},
                        },
                    }
                }
            else:
                # Multi-class ROC
                y_bin = label_binarize(y_test, classes=classes)
                roc_data = []
                colors = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899']
                for i, cls in enumerate(classes):
                    fpr, tpr, _ = roc_curve(y_bin[:, i], y_proba[:, i])
                    roc_auc_val = auc(fpr, tpr)
                    roc_data.append({
                        'type': 'scatter',
                        'x': fpr.tolist(),
                        'y': tpr.tolist(),
                        'mode': 'lines',
                        'name': f'Class {cls} (AUC={roc_auc_val:.3f})',
                        'line': {'color': colors[i % len(colors)], 'width': 2},
                    })
                roc_data.append({
                    'type': 'scatter', 'x': [0, 1], 'y': [0, 1],
                    'mode': 'lines', 'name': 'Random',
                    'line': {'color': '#4B5563', 'dash': 'dash'},
                })
                explanation['roc_curve'] = {
                    'plotly': {
                        'data': roc_data,
                        'layout': {
                            'title': 'ROC Curves (One-vs-Rest)',
                            'xaxis': {'title': 'False Positive Rate'},
                            'yaxis': {'title': 'True Positive Rate'},
                            'paper_bgcolor': 'rgba(0,0,0,0)',
                            'plot_bgcolor': 'rgba(0,0,0,0)',
                            'font': {'color': '#F9FAFB'},
                        },
                    }
                }
    
    # ── Feature Importance Bar Chart (Plotly) ──
    if explanation.get('feature_importance'):
        fi = explanation['feature_importance']
        top_n = dict(list(fi.items())[:15])  # Top 15 features
        explanation['feature_importance_chart'] = {
            'plotly': {
                'data': [{
                    'type': 'bar',
                    'x': list(top_n.values()),
                    'y': list(top_n.keys()),
                    'orientation': 'h',
                    'marker': {
                        'color': list(top_n.values()),
                        'colorscale': [[0, '#06B6D4'], [1, '#8B5CF6']],
                    },
                }],
                'layout': {
                    'title': 'Feature Importance (SHAP)',
                    'xaxis': {'title': 'Mean |SHAP value|'},
                    'yaxis': {'autorange': 'reversed'},
                    'paper_bgcolor': 'rgba(0,0,0,0)',
                    'plot_bgcolor': 'rgba(0,0,0,0)',
                    'font': {'color': '#F9FAFB'},
                    'margin': {'l': 150},
                },
            }
        }
    
    return explanation
