
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useOrders, Order, OrderStatus, updateOrderStatus, addProductToOrder, OrderItem, deleteOrder } from '@/lib/orders';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Search, DollarSign, Edit, History, ListOrdered, Loader2, Download, Settings, Trash2, Users, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useProducts, Product } from '@/lib/products';
import Image from 'next/image';
import { useDebounce } from 'use-debounce';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


export default function AdminDashboardPage() {
  const { orders, isInitialized: isOrdersInitialized } = useOrders();
  const { products, isInitialized: isProductsInitialized } = useProducts();
  const [highlightedProducts, setHighlightedProducts] = useState<Record<string, number[]>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(productSearchTerm, 300);
  const [formattedDates, setFormattedDates] = useState<Record<string, string>>({});
  const [formattedItemDates, setFormattedItemDates] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'Todos'>('Todos');
  const [isDemoNoticeVisible, setIsDemoNoticeVisible] = useState(false);
  
  const isMountedAndInitialized = isOrdersInitialized && isProductsInitialized;

  useEffect(() => {
    setIsDemoNoticeVisible(true);
  }, []);

  useEffect(() => {
    if (!isMountedAndInitialized || !orders) return;
    const newFormattedDates: Record<string, string> = {};
    const newFormattedItemDates: Record<string, string> = {};

    orders.forEach(order => {
        newFormattedDates[`order-${order.id}`] = format(new Date(order.timestamp), "d 'de' LLLL, h:mm a", { locale: es });
        
        order.items.forEach(item => {
            newFormattedItemDates[`item-${order.id}-${item.id}-${item.addedAt}`] = format(new Date(item.addedAt), "h:mm a", { locale: es });
        });
    });
    setFormattedDates(newFormattedDates);
    setFormattedItemDates(newFormattedItemDates);
  }, [orders, isMountedAndInitialized]);


  const handleStatusChange = (orderId: number, newStatus: OrderStatus) => {
    updateOrderStatus(orderId, newStatus);
  };
  
  const openAddProductModal = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
    setProductSearchTerm('');
  };

  const handleAddProduct = (product: Product) => {
    if (!selectedOrder) return;

    const newProduct: Omit<OrderItem, 'addedAt'> = {
      id: product.id,
      nombre: product.nombre,
      precio: product.precio,
      quantity: 1,
    };
    const adminName = localStorage.getItem('userName') || 'Admin';
    addProductToOrder(selectedOrder.id, newProduct, adminName);

    setHighlightedProducts(prev => ({
      ...prev,
      [selectedOrder.id]: [...(prev[selectedOrder.id] || []), newProduct.id]
    }));
    
    setIsModalOpen(false);

    setTimeout(() => {
        setHighlightedProducts(prev => ({
            ...prev,
            [selectedOrder.id]: (prev[selectedOrder.id] || []).filter(id => id !== newProduct.id)
        }));
    }, 2000); // Highlight for 2 seconds
  };

  const filteredProducts = (products || []).filter((product) =>
    product.nombre.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  );
  
  const filteredOrders = isMountedAndInitialized ? (orders || []).filter(order => {
    if (filterStatus === 'Todos') return true;
    return order.status === filterStatus;
  }) : [];

  const getStatusBadgeVariant = (status: OrderStatus) => {
    switch (status) {
      case 'Pendiente':
        return 'destructive';
      case 'En Preparación':
        return 'secondary';
      case 'Completado':
        return 'warning';
      case 'Pagado':
        return 'success';
      default:
        return 'outline';
    }
  };

  const totalSales = isMountedAndInitialized && orders ? orders.reduce((sum, order) => sum + order.total, 0) : 0;
  
  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) {
      alert("No hay datos para generar el informe.");
      return;
    }
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${(row[header] ?? '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const generateTotalSalesReport = () => {
    const reportData = (orders || []).map(order => ({
      'ID Pedido': order.id,
      'Fecha': format(new Date(order.timestamp), "yyyy-MM-dd HH:mm:ss"),
      'Cliente': order.customer.name,
      'Celular Cliente': order.customer.phone,
      'Atendido Por': order.attendedBy || order.orderedBy.name,
      'Tipo Venta': order.orderedBy.type,
      'Estado': order.status,
      'Total': order.total
    }));
    downloadCSV(reportData, 'informe-ventas-totales');
  };

  const generateProductSalesReport = () => {
    const productSales: Record<number, { nombre: string; cantidad: number; total: number }> = {};

    (orders || []).forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.id]) {
          productSales[item.id] = { nombre: item.nombre, cantidad: 0, total: 0 };
        }
        productSales[item.id].cantidad += item.quantity;
        productSales[item.id].total += item.precio * item.quantity;
      });
    });

    const reportData = Object.values(productSales).map(p => ({
      'Producto': p.nombre,
      'Cantidad Vendida': p.cantidad,
      'Total Ventas': p.total
    })).sort((a,b) => b['Cantidad Vendida'] - a['Cantidad Vendida']);
    downloadCSV(reportData, 'informe-ventas-por-producto');
  };
  
  const generateInventoryReport = () => {
    const productSales: Record<number, number> = {};
    (orders || []).forEach(order => {
      order.items.forEach(item => {
        productSales[item.id] = (productSales[item.id] || 0) + item.quantity;
      });
    });

    const reportData = (products || []).map(product => {
      const cantidadVendida = productSales[product.id] || 0;
      const existenciasActuales = product.existencias;
      return {
        'ID Producto': product.id,
        'Nombre': product.nombre,
        'Categoría': product.categoria,
        'Existencias Actuales': existenciasActuales,
        'Cantidad Vendida': cantidadVendida,
        'Existencias Disponibles': existenciasActuales - cantidadVendida,
        'Disponibilidad': product.disponibilidad
      };
    }).sort((a, b) => a['ID Producto'] - b['ID Producto']);
    downloadCSV(reportData, 'informe-inventario');
  };

  const handleDeleteOrder = (orderId: number) => {
    deleteOrder(orderId);
  };

  return (
    <div className="container mx-auto py-8 relative">
       {isDemoNoticeVisible && (
        <Alert className="fixed bottom-4 right-4 z-50 w-full max-w-sm bg-card/90 backdrop-blur-sm p-3 text-muted-foreground">
          <Info className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold text-foreground">Aviso Importante</AlertTitle>
          <AlertDescription className="text-xs">
            Este aplicativo fue realizado a manera de demo y cuenta con un tiempo
            limite. Contacte a su Administrador para activar su cuenta.
          </AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-auto w-auto p-1"
            onClick={() => setIsDemoNoticeVisible(false)}
          >
            <X className="h-4 w-4 font-bold" />
            <span className="sr-only">Cerrar</span>
          </Button>
        </Alert>
      )}

      <div className="text-center mb-8 pt-12">
        <h1 className="text-4xl font-bold">Panel de Administrador</h1>
        <p className="text-muted-foreground">Aquí puedes ver y gestionar todos los pedidos del sistema.</p>
        {isMountedAndInitialized && totalSales > 0 && (
            <div className="text-center mt-4">
                <p className="text-lg font-semibold flex items-center justify-center gap-2">
                    <DollarSign className="h-6 w-6 text-green-500"/>
                    Ventas Totales del Sistema: 
                    <span className="text-primary">${totalSales.toLocaleString('es-CO')}</span>
                </p>
            </div>
           )}
      </div>
      
      <Card>
        <CardHeader className="flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>
                Pedidos Recibidos {isMountedAndInitialized ? `(${filteredOrders.length})` : '...'}
              </CardTitle>
              <CardDescription>Los pedidos más recientes aparecen primero.</CardDescription>
            </div>
             <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">Filtrar:</span>
                 <Select
                    value={filterStatus}
                    onValueChange={(value: OrderStatus | 'Todos') => setFilterStatus(value)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Todos">Todos los Pedidos</SelectItem>
                        <SelectItem value="Pendiente">Pendiente</SelectItem>
                        <SelectItem value="En Preparación">En Preparación</SelectItem>
                        <SelectItem value="Completado">Completado</SelectItem>
                        <SelectItem value="Pagado">Pagado</SelectItem>
                    </SelectContent>
                </Select>
                 <Button variant="outline" asChild>
                    <Link href="/admin/my-orders">
                        <History className="mr-2 h-4 w-4" />
                        Mis Pedidos Atendidos
                    </Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href="/admin/products">
                        <ListOrdered className="mr-2 h-4 w-4" />
                        Gestionar Productos
                    </Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href="/admin/users">
                        <Users className="mr-2 h-4 w-4" />
                        Gestionar Usuarios
                    </Link>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Descargar Informes
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={generateTotalSalesReport}>
                            Informe de Ventas Totales
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={generateProductSalesReport}>
                            Informe de Ventas por Producto
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={generateInventoryReport}>
                            Informe de Inventario
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                 <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/settings">
                        <Settings className="h-5 w-5" />
                    </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          {!isMountedAndInitialized ? (
             <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
             </div>
          ) : filteredOrders.length > 0 ? (
            <Accordion type="single" collapsible className="w-full" defaultValue={filteredOrders.length > 0 ? "item-0" : undefined}>
              {filteredOrders.map((order, index) => (
                <AccordionItem 
                  key={order.id} 
                  value={`item-${index}`} 
                  className="border-border rounded-lg mb-2 bg-card"
                >
                  <div className="flex justify-between items-center w-full px-4">
                    <AccordionTrigger className="flex-grow hover:no-underline">
                      <div className="flex justify-between items-center w-full">
                        <div className="text-left">
                          <span className="font-bold text-lg">Pedido #{order.id}</span>
                          <span className="font-bold text-lg block">Cliente: {order.customer.name}</span>
                          <p className="text-sm text-muted-foreground">
                            {formattedDates[`order-${order.id}`] || 'Cargando fecha...'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                           <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
                           <span className="font-semibold text-lg">
                             ${order.total.toLocaleString('es-CO')}
                           </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                              <Trash2 className="h-5 w-5 text-destructive" />
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                          <AlertDialogTitle>¿Estás seguro de que quieres eliminar el pedido #{order.id}?</AlertDialogTitle>
                          <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará el pedido permanentemente.
                          </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteOrder(order.id)}>
                              Eliminar Pedido
                          </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                  </div>
                  <AccordionContent className="px-4 pb-4">
                     <div className="mb-4">
                        <p className="font-semibold mb-1">
                            Pedido por: <span className="font-normal">{order.orderedBy.type} ({order.orderedBy.name})</span>
                        </p>
                         {order.attendedBy && (
                            <p className="font-semibold mb-1 text-sm">
                                Atendido por: <span className="font-normal">{order.attendedBy}</span>
                            </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                            <strong>Celular:</strong> {order.customer.phone}
                        </p>
                     </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-center">Cant.</TableHead>
                                <TableHead>Agregado a las</TableHead>
                                <TableHead className="text-right">Subtotal</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {order.items.map((item) => (
                                <TableRow key={`${item.id}-${item.addedAt}`} className={cn(highlightedProducts[order.id]?.includes(item.id) && 'animate-highlight')}>
                                    <TableCell>{item.nombre}</TableCell>
                                    <TableCell className="text-center">{item.quantity}</TableCell>
                                    <TableCell>{formattedItemDates[`item-${order.id}-${item.id}-${item.addedAt}`] || '...'}</TableCell>
                                    <TableCell className="text-right">${(item.precio * item.quantity).toLocaleString('es-CO')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <div className="mt-4 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                             <span className="text-sm font-medium">Cambiar Estado:</span>
                             <Select
                                value={order.status}
                                onValueChange={(value: OrderStatus) => handleStatusChange(order.id, value)}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Cambiar estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                                    <SelectItem value="En Preparación">En Preparación</SelectItem>
                                    <SelectItem value="Completado">Completado</SelectItem>
                                    <SelectItem value="Pagado">Pagado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                         <Button variant="outline" size="sm" onClick={() => openAddProductModal(order)}>
                            <PlusCircle className="mr-2 h-4 w-4"/>
                            Adicionar Producto
                        </Button>
                    </div>

                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No se encontraron pedidos con el estado seleccionado.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Añadir Producto al Pedido #{selectedOrder?.id}</DialogTitle>
                <DialogDescription>
                    Busca y selecciona un producto para añadir al pedido.
                </DialogDescription>
            </DialogHeader>
             <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar productos..."
                className="pl-10"
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex-grow overflow-y-auto -mx-6 px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredProducts.map(product => (
                        <Card key={product.id}>
                            <CardContent className="p-4 flex flex-col gap-2">
                                <Image 
                                    src={product.imagen || 'https://placehold.co/100x100.png'}
                                    alt={product.nombre}
                                    width={100}
                                    height={100}
                                    className="rounded-md object-cover w-full h-24"
                                    data-ai-hint="beverage drink"
                                />
                                <h3 className="font-semibold h-10">{product.nombre}</h3>
                                <p className="text-sm text-muted-foreground">${product.precio.toLocaleString('es-CO')}</p>
                                <Button 
                                    size="sm" 
                                    onClick={() => handleAddProduct(product)}
                                    disabled={product.disponibilidad === 'PRODUCTO_AGOTADO'}
                                >
                                    {product.disponibilidad === 'PRODUCTO_AGOTADO' ? 'Agotado' : 'Agregar'}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
