import React, { useState } from "react";
import { FileText, Upload, CheckCircle, Camera } from "lucide-react";
import { Label } from "./components";
import { Modal, message } from 'antd';
import "./DocumentsUpload.css";
import { buildApiPathUrl } from "../config/api";




const DocumentItem = ({
  id,
  label,
  doc,
  onFileSelect,
  accept,
  maxSizeMB,
  uploadedLabel,
  disabled = false,
  circle = false,
  icon,
}) => {



  return (
    <div className="document-card">
      <div className="document-header">
        {icon}
        <h3 className="document-title">{label}</h3>
        {doc.uploaded && <CheckCircle className="document-check-icon" />}
      </div>

      <Label htmlFor={id} className="document-label">
        <div className={`document-dropzone ${doc.file ? "uploaded" : "default"}`}>
          {doc.preview ? (
            <div className="document-preview">
              <img
                src={doc.preview}
                alt="preview"
                className={`document-image ${circle ? "circle" : "rectangle"}`}
              />
              <p className="document-filename">{doc.file?.name}</p>
            </div>
          ) : doc.file ? (
            <div className="document-preview">
              <FileText className="document-icon" />
              <p className="document-filename">{doc.file.name}</p>
            </div>
          ) : (
            <div className="document-empty">
              <Upload className="document-upload-icon" />
              <p className="document-instruction">Clique ou arraste</p>
              <p className="document-hint">JPG, PNG, PDF (até {maxSizeMB} MB)</p>
            </div>
          )}
        </div>
      </Label>

      <input
        id={id}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
        }}
        disabled={disabled || doc.uploaded}
      />

      {doc.uploaded && (
        <div className="document-success">
          <CheckCircle className="document-check-small" />
          {uploadedLabel || "Enviado com sucesso"}
        </div>
      )}
    </div>
  );
};

const DocumentsUpload = ({ maxSizeMB = 5 }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [docs, setDocs] = useState({
    rgFront: { file: null, preview: null, uploaded: false, uploadedLabel: "" },
    rgBack: { file: null, preview: null, uploaded: false, uploadedLabel: "" },
    cpf: { file: null, preview: null, uploaded: false, uploadedLabel: "" },
    comprovante: { file: null, preview: null, uploaded: false, uploadedLabel: "" },
    selfie: { file: null, preview: null, uploaded: false, uploadedLabel: "" },
  });


const handleSubmit = async () => {
  if (isSubmitting) return;
  const formData = new FormData();
  Object.entries(docs).forEach(([key, value]) => {
  console.log(key, value)

    if (value.file) {
      formData.append(key, value.file);
    }
  });

  const token = localStorage.getItem("token");
  if (!token) {
    Modal.error({
      title: 'Não autenticado',
          content: 'Token não encontrado. Faça login novamente.',
    });
    return;
  }
  try {
    setIsSubmitting(true);
    const response = await fetch(buildApiPathUrl("/upload-document"), {
      method: "POST",
       headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (response.ok) {
      message.success('Arquivos enviados com sucesso!');
    } else {
      message.error('Erro ao enviar arquivos.');
    }
  } catch (error) {
    message.error('Erro na requisição: ' + error.message);
  } finally {
    setIsSubmitting(false);
  }
};

  const handleFileSelect = (key, file) => {
    const isAllowedSize = file.size <= maxSizeMB * 1024 * 1024;
    if (!isAllowedSize) {
      Modal.error({
        title: 'Arquivo muito grande',
        content: `Arquivo excede o limite de ${maxSizeMB}MB.`,
      });
      return;
    }

    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;

    setDocs((prev) => ({
      ...prev,
      [key]: { file, preview, uploaded: false, uploadedLabel: "" },
    }));

    setTimeout(() => {
      setDocs((prev) => ({
        ...prev,
        [key]: { file, preview, uploaded: true, uploadedLabel: "Enviado com sucesso" },
      }));
    }, 1200);
  };

  return (
    <div className="body">
    <div className="documents-container">
      <DocumentItem
        id="rg-front"
        label="RG - Frente"
        doc={docs.rgFront}
        onFileSelect={(file) => handleFileSelect("rgFront", file)}
        accept="image/jpeg,image/png,application/pdf"
        maxSizeMB={maxSizeMB}
        icon={<FileText className="document-icon-header" />}
      />

      <DocumentItem
        id="rg-back"
        label="RG - Verso"
        doc={docs.rgBack}
        onFileSelect={(file) => handleFileSelect("rgBack", file)}
        accept="image/jpeg,image/png,application/pdf"
        maxSizeMB={maxSizeMB}
        icon={<FileText className="document-icon-header" />}
      />

      <DocumentItem
        id="cpf"
        label="CPF"
        doc={docs.cpf}
        onFileSelect={(file) => handleFileSelect("cpf", file)}
        accept="image/jpeg,image/png,application/pdf"
        maxSizeMB={maxSizeMB}
        icon={<FileText className="document-icon-header" />}
      />

      <DocumentItem
        id="comprovante"
        label="Comprovante de Residncia"
        doc={docs.comprovante}
        onFileSelect={(file) => handleFileSelect("comprovante", file)}
        accept="image/jpeg,image/png,application/pdf"
        maxSizeMB={maxSizeMB}
        icon={<FileText className="document-icon-header" />}
      />

      <DocumentItem
        id="selfie"
        label="Selfie (Scan Facial)"
        doc={docs.selfie}
        onFileSelect={(file) => handleFileSelect("selfie", file)}
        accept="image/jpeg,image/png"
        maxSizeMB={maxSizeMB}
        circle
        icon={<Camera className="document-icon-header" />}
      />

    <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <button
            onClick={handleSubmit}
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enviando..." : "Enviar para anlise"}
          </button>
        </div>

    </div>
    
    </div>
  );
};

export default DocumentsUpload;
