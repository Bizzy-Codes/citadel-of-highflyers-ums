import { VideoOff } from 'lucide-react';
import { useCameraPreview } from '../../hooks/useCameraPreview';

interface CameraPreviewProps {
  active: boolean;
}

const CameraPreview = ({ active }: CameraPreviewProps) => {
  const { videoRef, error } = useCameraPreview(active);

  if (!active) return null;

  return (
    <div className="camera-preview-corner">
      {error ? (
        <div className="camera-preview-error">
          <VideoOff size={18} />
          <span>Camera unavailable</span>
        </div>
      ) : (
        <video ref={videoRef} autoPlay muted playsInline />
      )}
    </div>
  );
};

export default CameraPreview;
