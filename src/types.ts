import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  created_at: string;
}

export interface Order {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  service_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  order_date: string;
  delivery_date: string;
  status: 'Orçamento' | 'Em Produção' | 'Finalizado' | 'Entregue' | 'Arquivado';
  notes?: string;
  batch_id?: string;
  batch_items?: Order[];
  images?: string[];
  created_at: string;
}

export interface Stats {
  totalOrders: number;
  ongoingOrders: number;
  monthlyRevenue: number;
  totalCustomers: number;
  pendingOrders: number;
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  } catch (e) {
    return dateString;
  }
};

export const maskPhone = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/\D/g, '');
  const phoneNumberLength = phoneNumber.length;

  if (phoneNumberLength <= 2) {
    return phoneNumberLength > 0 ? `(${phoneNumber}` : '';
  }
  if (phoneNumberLength <= 6) {
    return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2)}`;
  }
  if (phoneNumberLength <= 10) {
    return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 6)}-${phoneNumber.slice(6)}`;
  }
  return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 7)}-${phoneNumber.slice(7, 11)}`;
};
