import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { Camera, Loader2, CheckCircle, AlertCircle, FileText, Trash2 } from 'lucide-react';

interface OCRResultExtractorProps {
  onResultsExtracted: (data: { subject: string; score: number }[]) => void;
  onCancel: () => void;
}

const OCRResultExtractor = ({ onResultsExtracted, onCancel }: OCRResultExtractorProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        processImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (imageSrc: string) => {
    setIsProcessing(true);
    setProgress(0);
    
    try {
      const result = await Tesseract.recognize(
        imageSrc,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgress(Math.floor(m.progress * 100));
            }
          }
        }
      );
      
      setExtractedText(result.data.text);
      parseResults(result.data.text);
    } catch (error) {
      console.error('OCR Error:', error);
      alert('Failed to extract text from image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const parseResults = (text: string) => {
    // Basic parsing logic: Looking for lines like "Mathematics: 85" or "English - 90"
    const lines = text.split('\n');
    const parsedResults: { subject: string; score: number }[] = [];
    
    lines.forEach(line => {
      const match = line.match(/([a-zA-Z\s]+)[:\-\s]+(\d+)/);
      if (match) {
        const subject = match[1].trim();
        const score = parseInt(match[2]);
        if (subject && !isNaN(score)) {
          parsedResults.push({ subject, score });
        }
      }
    });

    if (parsedResults.length > 0) {
      onResultsExtracted(parsedResults);
    } else {
      alert("No clear subject/score patterns found. Please try again or enter manually.");
    }
  };

  return (
    <div className="ocr-extractor glass" style={{ padding: '24px', borderRadius: '24px', maxWidth: '500px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Camera size={20} /> AI Result Extraction
        </h3>
        <button onClick={onCancel} className="icon-btn"><Trash2 size={18} /></button>
      </div>

      {!image && (
        <div 
          onClick={() => fileInputRef.current?.click()}
          style={{ 
            border: '2px dashed var(--glass-border)', 
            borderRadius: '16px', 
            padding: '40px 20px', 
            textAlign: 'center', 
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)'
          }}
        >
          <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.5 }} />
          <p style={{ fontWeight: '600', marginBottom: '4px' }}>Click to Upload Result Image</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Supported: JPG, PNG, WEBP</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
        </div>
      )}

      {image && (
        <div style={{ position: 'relative' }}>
          <img src={image} alt="Source" style={{ width: '100%', borderRadius: '12px', marginBottom: '16px', filter: isProcessing ? 'blur(2px)' : 'none' }} />
          
          {isProcessing && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', color: 'white' }}>
              <Loader2 size={32} className="animate-spin" style={{ marginBottom: '12px' }} />
              <p style={{ fontWeight: '700' }}>AI Extracting... {progress}%</p>
            </div>
          )}
        </div>
      )}

      {extractedText && !isProcessing && (
        <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid var(--success)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontWeight: '700', marginBottom: '8px' }}>
            <CheckCircle size={16} /> Extraction Complete
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>AI found patterns for subjects and scores. Verifying details...</p>
        </div>
      )}
    </div>
  );
};

export default OCRResultExtractor;
