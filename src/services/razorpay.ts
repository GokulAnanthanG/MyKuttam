import RazorpayCheckout from 'react-native-razorpay';

const RAZORPAY_KEY_ID = 'rzp_test_dxXDCjBQqv49O6';

export type RazorpayOptions = {
  description: string;
  image?: string;
  currency: string;
  key: string;
  amount: number;
  name: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  theme?: {
    color?: string;
  };
};

export type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
};

export const RazorpayService = {
  openCheckout: async (options: RazorpayOptions): Promise<RazorpayResponse> => {
    return new Promise((resolve, reject) => {
      RazorpayCheckout.open(options)
        .then((data: RazorpayResponse) => {
          resolve(data);
        })
        .catch((error: any) => {
          // User cancelled or error occurred
          if (error?.code === 'BAD_REQUEST_ERROR') {
            reject(new Error('Invalid payment details'));
          } else if (error?.code === 'NETWORK_ERROR') {
            reject(new Error('Network error. Please check your connection.'));
          } else if (error?.code === 'PAYMENT_CANCELLED') {
            reject(new Error('Payment cancelled by user'));
          } else {
            reject(new Error(error?.description || 'Payment failed'));
          }
        });
    });
  },
};

export const createRazorpayOptions = (
  amount: number,
  description: string,
  userName?: string,
  userPhone?: string,
  userEmail?: string,
): RazorpayOptions => {
  // Convert amount to paise (Razorpay expects amount in smallest currency unit)
  const amountInPaise = Math.round(amount * 100);

  return {
    description,
    currency: 'INR',
    key: RAZORPAY_KEY_ID,
    amount: amountInPaise,
    name: 'MyKuttam',
    prefill: {
      ...(userName && { name: userName }),
      ...(userPhone && { contact: userPhone }),
      ...(userEmail && { email: userEmail }),
    },
    theme: {
      color: '#8b6f47', // Using primary color from theme
    },
  };
};



