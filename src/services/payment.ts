import { endpoints } from '../config/api';

export type InitiatePaymentPayload = {
  user_id: string;
  amount: number;
  subcategory_id: string;
  callback_url?: string; // Deep link URL to redirect after payment completion
};

export type InitiatePaymentResponse = {
  success: boolean;
  message: string;
  data: {
    paymentUrl: string;
    orderId: string;
    amount: number;
  } | null;
};

export const PaymentService = {
  /**
   * Initiate payment and get payment URL
   */
  initiatePayment: async (
    payload: InitiatePaymentPayload,
  ): Promise<InitiatePaymentResponse> => {
    try {
      console.log('Initiating payment with payload:', payload);
      
      const response = await fetch(endpoints.initiatePayment, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log('Payment API response status:', response.status);
      console.log('Payment API response:', responseText);

      let data: InitiatePaymentResponse;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse payment response:', parseError);
        throw new Error('Invalid response from payment server');
      }

      if (!response.ok || !data.success) {
        const errorMessage = data.message || 'Failed to initiate payment';
        console.error('Payment initiation failed:', errorMessage);
        throw new Error(errorMessage);
      }

      if (!data.data?.paymentUrl) {
        console.error('Payment URL missing in response:', data);
        throw new Error('Payment URL not received from server');
      }

      console.log('Payment initiated successfully. URL:', data.data.paymentUrl);
      return data;
    } catch (error) {
      console.error('Payment initiation error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to initiate payment');
    }
  },
};

