import { useState, useEffect } from "react";
import { useReview } from "../../context/service";
import { useAddress } from "../../context/address";
import {
  API_CONFIG,
  VALIDATION,
  ERROR_MESSAGES,
  isCompletedStatus
} from "../constants";
import "./ServiceReview.css";

const ServiceReview = ({ onReviewSubmitted }) => {
  const { reviewService: service, closeReview } = useReview();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { userRole } = useAddress();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (service) {
      setRating(5);
      setHoverRating(0);
      setComment("");
      setError("");
      setIsSubmitting(false);
    }
  }, [service]);

  if (!service) return null;

  const existingReviews = service.reviews || {};

  const validateForm = () => {
    if (rating === 0) {
      setError(ERROR_MESSAGES.VALIDATION.RATING_REQUIRED);
      return false;
    }
    if (comment.trim().length < VALIDATION.MIN_COMMENT_LENGTH) {
      setError(ERROR_MESSAGES.VALIDATION.COMMENT_TOO_SHORT);
      return false;
    }
    setError("");
    return true;
  };

  const handleReviewSubmit = async () => {
    if (!token) {
      setError(ERROR_MESSAGES.UNAUTHORIZED);
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const reviewData =
        userRole === "cliente"
          ? {
              service_id: service.ID || service.id,
              client_rating: rating,
              client_comment: comment,
            }
          : {
              service_id: service.ID || service.id,
              diarist_rating: rating,
              diarist_comment: comment,
            };

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REVIEWS}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reviewData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || ERROR_MESSAGES.SUBMIT_REVIEW);
      }

      const data = await response.json();
      closeReview();
      if (onReviewSubmitted) onReviewSubmitted(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canReview = () => {
    if (userRole === "cliente") {
      return isCompletedStatus(service.status) && !(existingReviews.client_comment || existingReviews.ClientComment);
    }
    if (userRole === "diarista") {
      return isCompletedStatus(service.status) && !(existingReviews.diarist_comment || existingReviews.DiaristComment);
    }
    return false;
  };

  if (!canReview()) return null;

  return (
    <div className="review-overlay" onClick={closeReview}>
      <div className="review-popup" onClick={(e) => e.stopPropagation()}>
        <div className="modal-drag-handle"></div>
        <button className="close-button" onClick={closeReview} disabled={isSubmitting}>{'\u2715'}</button>

        <div className="review-header-content">
          <h3>Avaliar Experiência</h3>
          <p className="review-subtitle">
            Como foi o serviço com {userRole === "cliente" ? (service.diarist?.name || service.diarist?.Name || "a diarista") : (service.client?.name || service.client?.Name || "o cliente")}?
          </p>
        </div>

        <div className="star-rating">
          {Array.from({ length: 5 }, (_, i) => i + 1).map((star) => (
            <span
              key={star}
              className={`star ${star <= (hoverRating || rating) ? "filled" : ""}`}
              onClick={(e) => {
                if (!isSubmitting) setRating(star);
                e.stopPropagation();
              }}
              onMouseEnter={() => !isSubmitting && setHoverRating(star)}
              onMouseLeave={() => !isSubmitting && setHoverRating(0)}
            >
              {'\u2605'}
            </span>
          ))}
        </div>

        <p className="rating-description">
          {rating === 5 && "Excelente trabalho!"}
          {rating === 4 && "Muito bom!"}
          {rating === 3 && "Bom, mas pode melhorar."}
          {rating === 2 && "Abaixo do esperado."}
          {rating === 1 && "Insatisfatório."}
          {rating === 0 && "Selecione uma nota"}
        </p>

        <div className="comment-section">
          <textarea
            className="review-textarea"
            placeholder="Conte-nos mais sobre os detalhes..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isSubmitting}
            maxLength={500}
          />
          <div className="textarea-footer">
            <span className="char-count">{comment.length}/500</span>
          </div>
        </div>

        {error && <div className="error-message-bubble">{error}</div>}

        <div className="review-actions">
          <button
            className="submit-button-uber"
            onClick={handleReviewSubmit}
            disabled={isSubmitting || rating === 0}
          >
            {isSubmitting ? (
              <span className="loader-mini"></span>
            ) : "Confirmar Avaliação"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceReview;
