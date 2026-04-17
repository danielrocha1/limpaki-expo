import React, { createContext, useContext, useState } from "react";

const ReviewContext = createContext();

export const useReview = () => useContext(ReviewContext);

export const ReviewProvider = ({ children }) => {
  const [reviewService, setReviewService] = useState(null);

  const openReview = (service) => setReviewService(service);
  const closeReview = () => setReviewService(null);

  return (
    <ReviewContext.Provider value={{ reviewService, openReview, closeReview }}>
      {children}
    </ReviewContext.Provider>
  );
};
