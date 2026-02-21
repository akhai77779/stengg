import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface ShareButtonProps {
  productId: string;
  productName: string;
}

export function ShareButton({ productId, productName }: ShareButtonProps) {
  const handleShare = async () => {
    const url = `${window.location.origin}/products/${productId}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `${productName} Chart`, url });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  };

  return (
    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleShare}>
      <Share2 className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Share</span>
    </Button>
  );
}
