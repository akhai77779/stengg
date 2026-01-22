import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ProductStatus = Database['public']['Enums']['product_status'];

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  status: ProductStatus;
  category: string | null;
}

const statusLabels: Record<ProductStatus, string> = {
  available: 'Có sẵn',
  sold: 'Đã bán',
  pending: 'Chờ xử lý',
};

const statusColors: Record<ProductStatus, string> = {
  available: 'bg-green-500/20 text-green-400 border-green-500/50',
  sold: 'bg-red-500/20 text-red-400 border-red-500/50',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
};

export function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, image_url, price, status, category')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(4);

    if (error) {
      console.error('Error fetching products:', error);
    } else {
      setProducts(data || []);
    }
    setIsLoading(false);
  };

  // Placeholder data
  const placeholderProducts: Product[] = [
    {
      id: '1',
      name: 'Smart Sensor Kit Pro',
      description: 'Bộ cảm biến thông minh cho các dự án IoT',
      image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop',
      price: 2500000,
      status: 'available',
      category: 'IoT',
    },
    {
      id: '2',
      name: 'Development Board V2',
      description: 'Bo mạch phát triển đa năng thế hệ mới',
      image_url: 'https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=400&h=300&fit=crop',
      price: 1200000,
      status: 'available',
      category: 'Hardware',
    },
    {
      id: '3',
      name: 'Security Camera System',
      description: 'Hệ thống camera an ninh thông minh AI',
      image_url: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=400&h=300&fit=crop',
      price: 8500000,
      status: 'available',
      category: 'Security',
    },
    {
      id: '4',
      name: 'Drone Controller Unit',
      description: 'Bộ điều khiển drone chuyên nghiệp',
      image_url: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=400&h=300&fit=crop',
      price: 4200000,
      status: 'available',
      category: 'Aerospace',
    },
  ];

  const displayProducts = products.length > 0 ? products : placeholderProducts;

  const formatPrice = (price: number | null) => {
    if (!price) return 'Liên hệ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  return (
    <section className="py-16 bg-card/50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">
              <span className="text-gradient">Sản phẩm nổi bật</span>
            </h2>
            <p className="text-muted-foreground mt-2">
              Các sản phẩm đang được trade trong công ty
            </p>
          </div>
          <Button variant="ghost" asChild className="hidden md:flex">
            <Link to="/products" className="flex items-center gap-2">
              Xem tất cả
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-card border-border animate-pulse">
                <div className="h-48 bg-muted" />
                <CardContent className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded w-16" />
                  <div className="h-5 bg-muted rounded w-full" />
                  <div className="h-6 bg-muted rounded w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayProducts.map((product, index) => (
              <Link key={product.id} to={`/products/${product.id}`}>
                <Card 
                  className="group bg-card border-border hover:border-primary/50 hover:glow transition-all duration-300 overflow-hidden h-full"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={product.image_url || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 hero-overlay" />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Badge 
                      variant="outline" 
                      className={`absolute top-3 right-3 ${statusColors[product.status]}`}
                    >
                      {statusLabels[product.status]}
                    </Badge>
                    {product.category && (
                      <Badge variant="secondary" className="absolute top-3 left-3">
                        {product.category}
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-2">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-primary font-semibold">
                      <Tag className="w-4 h-4" />
                      {formatPrice(product.price)}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Mobile View All Button */}
        <div className="mt-8 text-center md:hidden">
          <Button asChild>
            <Link to="/products" className="flex items-center gap-2">
              Xem tất cả sản phẩm
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
