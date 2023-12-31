import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useAuthentication from "../../../hooks/useAuthentication";
import useSecureAxios from "../../../hooks/useSecureAxios";
import "./PaymentForm.css";
import useSelectedClass from "../../../hooks/useSelectedClass";
import Swal from "sweetalert2";

const PaymentForm = () => {
  const { id } = useParams();
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuthentication();
  const [secureAxios] = useSecureAxios();
  const [cardError, setCardError] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [processing, setProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [selectedClass] = useSelectedClass();

  const navigate = useNavigate();

  const matchedClass = selectedClass.find((classItem) => classItem._id === id);

  const price = matchedClass ? parseFloat(matchedClass.price) : 0;

  

  useEffect(() => {
    if (price > 0) {
      secureAxios.post("/create-payment-intent", { price }).then((res) => {
       
        setClientSecret(res.data.clientSecret);
      });
    }
  }, [price, secureAxios]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const card = elements.getElement(CardElement);
    if (card === null) {
      return;
    }

    const { error } = await stripe.createPaymentMethod({
      type: "card",
      card,
    });

    if (error) {
     
      setCardError(error.message);
    } else {
      setCardError("");
 
    }

    setProcessing(true);

    const { paymentIntent, error: confirmError } =
      await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: card,
          billing_details: {
            email: user?.email || "unknown",
            name: user?.displayName || "anonymous",
          },
        },
      });

    if (confirmError) {
      console.error(confirmError);
    }

    
    setProcessing(false);
    if (paymentIntent.status === "succeeded") {
      setTransactionId(paymentIntent.id);
      // save payment information to the server
      const payment = {
        email: user?.email,
        transactionId: paymentIntent.id,
        price,
        date: new Date(),
        status: "purchased",
        itemName: matchedClass.name,
        classId: matchedClass.classId,
        selectedClassId: matchedClass._id
      };
      console.error(payment)
      secureAxios.post("/payments", payment).then((res) => {
        if (res.data.insertResult.insertedId) {
          Swal.fire({
            position: 'top-end', 
            icon: 'success',
            title: 'Payment Completed',
            showConfirmButton: false,
            timer: 1500
          })
          navigate('/dashboard/selected-class')
        }
      });


    }
  };

  return (
    <>
      <form className="w-2/3 m-8" onSubmit={handleSubmit}>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#424770",
                "::placeholder": {
                  color: "#aab7c4",
                },
              },
              invalid: {
                color: "#9e2146",
              },
            },
          }}
        />
        <button
          className="btn btn-primary btn-sm mt-4"
          type="submit"
          disabled={!stripe || !clientSecret || processing}
        >
          Pay
        </button>
      </form>
      {cardError && <p className="text-red-600 ml-8">{cardError}</p>}
      {transactionId && (
        <p className="text-green-500">
          Transaction complete with transactionId: {transactionId}
        </p>
      )}
    </>
  );
};

export default PaymentForm;
