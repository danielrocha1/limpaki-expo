import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch, buildApiUrl, setToken } from "../../../config/api";
import MapConfirmModal from "../map/MapConfirmModal";

const STRIPE_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLIC_KEY || process.env.REACT_APP_STRIPE_PUBLIC_KEY || "";
const isStripeConfigured = !!STRIPE_PUBLIC_KEY && STRIPE_PUBLIC_KEY !== "SUA_CHAVE_PUBLICA_AQUI";

const palette = {
  surface: "#ffffff",
  ink: "#1f2937",
  muted: "#6b7280",
  accent: "#2563eb",
  accentSoft: "#dbeafe",
  accentBorder: "#bfdbfe",
  border: "#d9dee8",
  error: "#dc2626",
  errorBg: "#fef2f2",
  success: "#166534",
  successBg: "#edfdf3",
  warning: "#92400e",
  warningBg: "#fff7ed",
  info: "#1d4ed8",
  infoBg: "#eff6ff",
};

const planOptions = [
  {
    id: "monthly",
    name: "Mensal",
    price: 15.0,
    originalPrice: 19.9,
    description: "Ideal para quem quer testar",
    features: ["Acesso total", "Suporte prioritário", "Sem fidelidade"],
  },
  {
    id: "quarterly",
    name: "Trimestral",
    price: 37.0,
    originalPrice: 45.0,
    description: "O melhor custo-benefício",
    features: ["Acesso total", "Suporte prioritário", "Economize 20%"],
    popular: true,
  },
  {
    id: "yearly",
    name: "Anual",
    price: 150.0,
    originalPrice: 180.0,
    description: "Para quem quer economizar de verdade",
    features: ["Acesso total", "Suporte prioritário", "Economize 45%"],
    bestValue: true,
  },
];

const specialtyOptions = [
  { id: "basic_cleaning", label: "Limpeza Básica", icon: "🧹" },
  { id: "heavy_cleaning", label: "Limpeza Pesada", icon: "🪣" },
  { id: "ironing", label: "Passar Roupa", icon: "👕" },
  { id: "post_work", label: "Pós-obra", icon: "🚧" },
  { id: "organization", label: "Organização", icon: "📁" },
  { id: "window_cleaning", label: "Janelas", icon: "🪟" },
  { id: "carpet_cleaning", label: "Tapetes", icon: "🧽" },
  { id: "cooking", label: "Cozinhar", icon: "🍳" },
];

const residenceTypeOptions = [
  { value: "apartment", label: "Apartamento" },
  { value: "house", label: "Casa" },
  { value: "office", label: "Escritório" },
];

const hasPetsOptions = [
  { value: "no", label: "Não" },
  { value: "yes", label: "Sim" },
];

const frequencyOptions = [
  { value: "once", label: "Uma única vez" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
];

const initialClientData = () => ({
  name: "",
  email: "",
  phone: "",
  cpf: "",
  zip: "",
  street: "",
  number: "",
  neighborhood: "",
  complement: "",
  referencePoint: "",
  city: "",
  state: "",
  rooms: [],
  residenceType: "",
  hasPets: "",
  desiredFrequency: "",
  password: "",
  confirmPassword: "",
  latitude: 0,
  longitude: 0,
});

const initialDiaristData = () => ({
  name: "",
  email: "",
  phone: "",
  cpf: "",
  zip: "",
  street: "",
  number: "",
  neighborhood: "",
  complement: "",
  referencePoint: "",
  city: "",
  state: "",
  bio: "",
  experienceYears: "",
  pricePerHour: "",
  pricePerDay: "",
  specialties: [],
  available: true,
  password: "",
  confirmPassword: "",
  latitude: 0,
  longitude: 0,
});

function maskZip(zip = "") {
  return zip.length > 5 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : zip;
}

function normalizePhone(value = "") {
  return value.replace(/\D/g, "");
}

function normalizeCpf(value = "") {
  return value.replace(/\D/g, "");
}

function Field({ label, error, children, hint }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function TextField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType,
  secureTextEntry,
  editable = true,
  multiline = false,
  numberOfLines,
}) {
  return (
    <Field label={label} error={error}>
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          multiline && styles.textArea,
          !editable && styles.inputReadonly,
          error && styles.inputError,
        ]}
        value={value}
      />
    </Field>
  );
}

function OptionChips({ options, value, onChange, multiple = false }) {
  const selectedValues = multiple ? value || [] : [value];

  return (
    <View style={styles.chipsRow}>
      {options.map((option) => {
        const selected = selectedValues.includes(option.value || option.id);
        return (
          <Pressable
            key={option.value || option.id}
            onPress={() => onChange(option.value || option.id)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            {option.icon ? <Text style={styles.chipIcon}>{option.icon}</Text> : null}
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({ title, hint, complete, open, onToggle, children }) {
  return (
    <View style={styles.section}>
      <Pressable onPress={onToggle} style={[styles.sectionToggle, open && styles.sectionToggleOpen]}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionHint}>{hint}</Text>
        </View>
        <View style={styles.sectionMeta}>
          <View style={[styles.sectionStatus, complete ? styles.sectionStatusComplete : styles.sectionStatusPending]}>
            <Text style={[styles.sectionStatusText, complete && styles.sectionStatusTextComplete]}>
              {complete ? "Completo" : "Pendente"}
            </Text>
          </View>
          <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color="#64748b" />
        </View>
      </Pressable>
      {open ? <View style={styles.sectionPanel}>{children}</View> : null}
    </View>
  );
}

function StatusCard({ type, text }) {
  const variantStyle =
    type === "error"
      ? styles.statusError
      : type === "success"
        ? styles.statusSuccess
        : type === "warning"
          ? styles.statusWarning
          : styles.statusInfo;

  const textStyle =
    type === "error"
      ? styles.statusErrorText
      : type === "success"
        ? styles.statusSuccessText
        : type === "warning"
          ? styles.statusWarningText
          : styles.statusInfoText;

  return (
    <View style={[styles.statusCard, variantStyle]}>
      <Text style={textStyle}>{text}</Text>
    </View>
  );
}

function RoomsEditor({ rooms, onAdd, onChange, onRemove, error }) {
  return (
    <View style={styles.subSection}>
      <View style={styles.inlineBetween}>
        <View>
          <Text style={styles.subSectionTitle}>Cômodos</Text>
          <Text style={styles.subSectionHint}>
            Adicione banheiro, quarto, cozinha e outros ambientes com suas quantidades.
          </Text>
        </View>
        <TouchableOpacity onPress={onAdd} style={styles.smallButton}>
          <Feather name="plus" size={16} color="#ffffff" />
          <Text style={styles.smallButtonText}>Adicionar</Text>
        </TouchableOpacity>
      </View>

      {rooms.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardText}>
            Nenhum cômodo adicionado ainda. Use o botão acima para informar os ambientes da residência.
          </Text>
        </View>
      ) : (
        rooms.map((room, index) => (
          <View key={room.id} style={styles.roomCard}>
            <TextField
              label={`Nome do cômodo ${index + 1}`}
              onChangeText={(text) => onChange(room.id, "name", text)}
              placeholder="Ex.: Banheiro"
              value={room.name}
            />
            <TextField
              label="Quantidade"
              keyboardType="number-pad"
              onChangeText={(text) => onChange(room.id, "quantity", text)}
              placeholder="1"
              value={room.quantity}
            />
            <TouchableOpacity onPress={() => onRemove(room.id)} style={styles.removeButton}>
              <Feather name="trash-2" size={16} color="#dc2626" />
              <Text style={styles.removeButtonText}>Remover</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function PlanSelectionNative({ onBack, onPlanSelected, processingPlanId, error }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.roleHeader}>
        <Text style={styles.roleTitle}>Escolha seu plano</Text>
        <Text style={styles.roleCopy}>
          Selecione a melhor opção para você e siga para o checkout.
        </Text>
      </View>

      {error ? <StatusCard type="error" text={error} /> : null}

      {planOptions.map((plan) => {
        const processing = processingPlanId === plan.id;
        return (
          <View key={plan.id} style={styles.planCard}>
            {plan.popular ? <Text style={styles.planBadge}>Mais popular</Text> : null}
            {plan.bestValue ? <Text style={styles.planBadge}>Melhor valor</Text> : null}
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>
              R$ {plan.price.toFixed(2)} <Text style={styles.planPeriod}>/período</Text>
            </Text>
            <Text style={styles.planOriginal}>de R$ {plan.originalPrice.toFixed(2)}</Text>
            <Text style={styles.planDescription}>{plan.description}</Text>
            {plan.features.map((feature) => (
              <Text key={feature} style={styles.planFeature}>• {feature}</Text>
            ))}
            <TouchableOpacity
              disabled={Boolean(processingPlanId)}
              onPress={() => onPlanSelected(plan)}
              style={[styles.primaryButton, { marginTop: 16 }, Boolean(processingPlanId) && styles.primaryButtonDisabled]}
            >
              {processing ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Assinar</Text>}
            </TouchableOpacity>
          </View>
        );
      })}

      <TouchableOpacity onPress={onBack} style={[styles.secondaryButton, { marginTop: 8 }]}>
        <Text style={styles.secondaryButtonText}>Voltar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function RoleSelection({ onSelectRole, onBackToLogin }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.roleHeader}>
        <Text style={styles.roleTitle}>Bem-vindo ao Limpae</Text>
        <Text style={styles.roleCopy}>Escolha como você deseja usar nossa plataforma.</Text>
      </View>

      <TouchableOpacity onPress={() => onSelectRole("cliente")} style={styles.roleCard}>
        <Text style={styles.roleEmoji}>👤</Text>
        <Text style={styles.roleCardTitle}>Sou Cliente</Text>
        <Text style={styles.roleCardCopy}>Procuro contratar serviços de limpeza profissional.</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => onSelectRole("diarista")} style={styles.roleCard}>
        <Text style={styles.roleEmoji}>🧹</Text>
        <Text style={styles.roleCardTitle}>Sou Diarista</Text>
        <Text style={styles.roleCardCopy}>Quero oferecer meus serviços de limpeza.</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBackToLogin} style={[styles.secondaryButton, { marginTop: 10 }]}>
        <Text style={styles.secondaryButtonText}>Voltar para login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function RegisterClientForm({ onBack, onComplete }) {
  const [openSection, setOpenSection] = useState("personal");
  const [isRoomsOpen, setIsRoomsOpen] = useState(true);
  const [formData, setFormData] = useState(initialClientData);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapCoords, setMapCoords] = useState(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState(null);

  const personalInfoComplete =
    formData.name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(formData.email) &&
    normalizePhone(formData.phone).length >= 10 &&
    normalizeCpf(formData.cpf).length === 11;
  const addressComplete =
    formData.zip.length === 8 &&
    Boolean(formData.street.trim()) &&
    Boolean(formData.number.trim()) &&
    Boolean(formData.residenceType) &&
    Boolean(formData.neighborhood.trim()) &&
    Boolean(formData.city.trim()) &&
    Boolean(formData.state.trim()) &&
    formData.rooms.length > 0 &&
    formData.rooms.every((room) => room.name.trim() && Number(room.quantity) > 0) &&
    formData.latitude !== 0 &&
    formData.longitude !== 0;
  const preferencesComplete = Boolean(formData.hasPets && formData.desiredFrequency);
  const securityComplete =
    formData.password.length >= 6 &&
    formData.confirmPassword.length >= 6 &&
    formData.password === formData.confirmPassword;

  const canEditAddressFields = cepMessage?.type === "error";

  const validateForm = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Nome é obrigatório";
    else if (formData.name.trim().length < 2) nextErrors.name = "Nome deve ter pelo menos 2 caracteres";
    if (!formData.email.trim()) nextErrors.email = "E-mail é obrigatório";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) nextErrors.email = "E-mail inválido";
    if (!formData.phone.trim()) nextErrors.phone = "Telefone é obrigatório";
    else if (normalizePhone(formData.phone).length < 10) nextErrors.phone = "Telefone deve ter pelo menos 10 dígitos";
    if (!formData.cpf.trim()) nextErrors.cpf = "CPF é obrigatório";
    else if (normalizeCpf(formData.cpf).length !== 11) nextErrors.cpf = "CPF deve ter 11 dígitos";
    if (!formData.zip.trim()) nextErrors.zip = "CEP é obrigatório";
    else if (formData.zip.length !== 8) nextErrors.zip = "CEP deve ter 8 dígitos";
    if (!formData.street.trim()) nextErrors.street = "Rua é obrigatória";
    if (!formData.number.trim()) nextErrors.number = "Número é obrigatório";
    if (!formData.city.trim()) nextErrors.city = "Cidade é obrigatória";
    if (!formData.state.trim()) nextErrors.state = "Estado é obrigatório";
    if (
      formData.rooms.length === 0 ||
      formData.rooms.some((room) => !room.name.trim() || !Number(room.quantity) || Number(room.quantity) <= 0)
    ) {
      nextErrors.rooms = "Adicione pelo menos um cômodo com nome e quantidade válidos";
    }
    if (formData.latitude === 0 || formData.longitude === 0) {
      nextErrors.location = "Localize seu endereço no mapa antes de prosseguir";
    }
    if (!formData.password.trim()) nextErrors.password = "Senha é obrigatória";
    else if (formData.password.length < 6) nextErrors.password = "Senha deve ter pelo menos 6 caracteres";
    if (!formData.confirmPassword.trim()) nextErrors.confirmPassword = "Confirmação de senha é obrigatória";
    else if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = "As senhas não correspondem";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleZipCode = async (zip) => {
    setCepLoading(true);
    setCepMessage(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
      const data = await response.json();

      if (data?.erro) {
        setCepMessage({ type: "error", text: "CEP não encontrado. Confira os dígitos." });
        return;
      }

      setFormData((prev) => ({
        ...prev,
        street: data.logradouro || "",
        neighborhood: data.bairro || "",
        city: data.localidade || "",
        state: (data.uf || "").toUpperCase(),
      }));

      setCepMessage({ type: "info", text: "CEP encontrado! Buscando localização..." });

      const params = new URLSearchParams({
        q: [data.logradouro, data.bairro, data.localidade, data.uf, "Brasil"].filter(Boolean).join(", "),
        format: "jsonv2",
        limit: "1",
        countrycodes: "br",
      });
      const nominatimRes = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
      const nominatimData = await nominatimRes.json();

      if (Array.isArray(nominatimData) && nominatimData.length > 0) {
        const match = nominatimData[0];
        const lat = Number(match.lat);
        const lon = Number(match.lon);

        setMapCoords({ lat, lon });
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lon }));
        setCepMessage({ type: "success", text: "Localização encontrada! Confirme no mapa." });
        setShowMap(true);
      } else {
        setCepMessage({ type: "warning", text: "Não consegui localizar no mapa. Tente confirmar manualmente." });
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      setCepMessage({ type: "error", text: "Erro ao buscar CEP. Tente novamente." });
    } finally {
      setCepLoading(false);
    }
  };

  const updateField = (name, value) => {
    const cleanValue = name === "zip" ? value.replace(/\D/g, "").slice(0, 8) : value;
    const affectsLocation = ["zip", "street", "number", "neighborhood", "city", "state"].includes(name);

    setFormData((prev) => ({
      ...prev,
      [name]: cleanValue,
      ...(affectsLocation ? { latitude: 0, longitude: 0 } : {}),
    }));

    if (affectsLocation) {
      setMapCoords(null);
      if (name !== "zip") {
        setCepMessage({ type: "warning", text: "Endereço alterado. Confirme novamente a localização no mapa." });
      }
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }

    if (name === "zip" && cleanValue.length === 8) {
      void handleZipCode(cleanValue);
    }
  };

  const handleAddRoom = () => {
    setFormData((prev) => ({
      ...prev,
      rooms: [...prev.rooms, { id: `${Date.now()}-${prev.rooms.length}`, name: "", quantity: "" }],
    }));
    setIsRoomsOpen(true);
    if (errors.rooms) {
      setErrors((prev) => ({ ...prev, rooms: "" }));
    }
  };

  const handleRoomChange = (roomId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      rooms: prev.rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              [field]: field === "quantity" ? value.replace(/\D/g, "").slice(0, 2) : value,
            }
          : room,
      ),
    }));
  };

  const handleRemoveRoom = (roomId) => {
    setFormData((prev) => ({
      ...prev,
      rooms: prev.rooms.filter((room) => room.id !== roomId),
    }));
  };

  const submit = async () => {
    if (!validateForm()) {
      setIsRoomsOpen(true);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: parseInt(normalizePhone(formData.phone), 10),
        cpf: formData.cpf,
        password: formData.password,
        role: "cliente",
        address: {
          street: formData.street,
          number: formData.number,
          residence_type: formData.residenceType,
          neighborhood: formData.neighborhood,
          complement: formData.complement,
          referencePoint: formData.referencePoint,
          city: formData.city,
          state: formData.state,
          zipcode: formData.zip,
          latitude: formData.latitude,
          longitude: formData.longitude,
          rooms: formData.rooms
            .map((room) => ({ name: room.name.trim(), quantity: Number(room.quantity) }))
            .filter((room) => room.name && Number.isFinite(room.quantity) && room.quantity > 0),
        },
        client_preferences: {
          has_pets: formData.hasPets === "yes",
          desired_frequency: formData.desiredFrequency,
        },
      };

      await onComplete(payload);
    } catch (error) {
      setErrors({ general: error.message || "Não foi possível concluir o cadastro." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backLink}>
            <Feather name="arrow-left" size={16} color={palette.accent} />
            <Text style={styles.backLinkText}>Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>Registre-se como Cliente</Text>
          <Text style={styles.formCopy}>
            Encontre profissionais de limpeza com mais rapidez e organize sua rotina com mais facilidade.
          </Text>
        </View>

        {errors.general ? <StatusCard type="error" text={errors.general} /> : null}

        <Section
          complete={personalInfoComplete}
          hint="Preencha seus dados principais para criar sua conta e começar a solicitar serviços."
          onToggle={() => setOpenSection((prev) => (prev === "personal" ? "" : "personal"))}
          open={openSection === "personal"}
          title="Dados Pessoais"
        >
          <TextField label="Nome Completo" error={errors.name} value={formData.name} onChangeText={(text) => updateField("name", text)} placeholder="Digite seu nome completo" />
          <TextField label="E-mail" error={errors.email} value={formData.email} onChangeText={(text) => updateField("email", text)} placeholder="Digite seu e-mail" keyboardType="email-address" />
          <TextField label="Telefone" error={errors.phone} value={formData.phone} onChangeText={(text) => updateField("phone", text)} placeholder="(11) 99999-9999" keyboardType="phone-pad" />
          <TextField label="CPF" error={errors.cpf} value={formData.cpf} onChangeText={(text) => updateField("cpf", text)} placeholder="000.000.000-00" keyboardType="number-pad" />
        </Section>

        <Section
          complete={addressComplete}
          hint="Use o CEP para preencher o endereço automaticamente e depois confirme a localização no mapa."
          onToggle={() => setOpenSection((prev) => (prev === "address" ? "" : "address"))}
          open={openSection === "address"}
          title="Endereço"
        >
          <TextField
            label="CEP"
            error={errors.zip}
            value={maskZip(formData.zip)}
            onChangeText={(text) => updateField("zip", text)}
            placeholder="00000-000"
            keyboardType="number-pad"
          />
          {cepLoading ? <Text style={styles.fieldHint}>Buscando...</Text> : null}
          {cepMessage ? <StatusCard type={cepMessage.type} text={cepMessage.text} /> : null}
          <TextField label="Rua" error={errors.street} value={formData.street} onChangeText={(text) => updateField("street", text)} placeholder="Digite sua rua" editable={canEditAddressFields} />
          <TextField label="Número" error={errors.number} value={formData.number} onChangeText={(text) => updateField("number", text)} placeholder="Digite o número" />
          <Field label="Tipo do Endereço">
            <OptionChips
              options={residenceTypeOptions}
              value={formData.residenceType}
              onChange={(selected) => updateField("residenceType", selected)}
            />
          </Field>
          <TextField label="Bairro" value={formData.neighborhood} onChangeText={(text) => updateField("neighborhood", text)} placeholder="Digite seu bairro" editable={canEditAddressFields} />
          <TextField label="Complemento" value={formData.complement} onChangeText={(text) => updateField("complement", text)} placeholder="Apto, bloco, etc." />
          <TextField label="Ponto de Referência" value={formData.referencePoint} onChangeText={(text) => updateField("referencePoint", text)} placeholder="Próximo a..." />
          <TextField label="Cidade" error={errors.city} value={formData.city} onChangeText={(text) => updateField("city", text)} placeholder="Digite sua cidade" editable={canEditAddressFields} />
          <TextField label="Estado" error={errors.state} value={formData.state} onChangeText={(text) => updateField("state", text.toUpperCase())} placeholder="SP" editable={canEditAddressFields} />

          <Pressable onPress={() => setIsRoomsOpen((prev) => !prev)} style={styles.roomsToggle}>
            <Text style={styles.roomsToggleTitle}>Cômodos</Text>
            <Feather name={isRoomsOpen ? "chevron-up" : "chevron-down"} size={18} color="#64748b" />
          </Pressable>
          {isRoomsOpen ? (
            <RoomsEditor
              rooms={formData.rooms}
              onAdd={handleAddRoom}
              onChange={handleRoomChange}
              onRemove={handleRemoveRoom}
              error={errors.rooms}
            />
          ) : null}

          {(formData.latitude !== 0 || formData.longitude !== 0) ? (
            <TouchableOpacity onPress={() => setShowMap(true)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Ajustar localização no mapa</Text>
            </TouchableOpacity>
          ) : null}
          {errors.location ? <Text style={styles.fieldError}>{errors.location}</Text> : null}
        </Section>

        <Section
          complete={preferencesComplete}
          hint="Defina a frequência e o contexto do atendimento."
          onToggle={() => setOpenSection((prev) => (prev === "preferences" ? "" : "preferences"))}
          open={openSection === "preferences"}
          title="Preferências do Serviço"
        >
          <Field label="Possui Animais?">
            <OptionChips options={hasPetsOptions} value={formData.hasPets} onChange={(selected) => updateField("hasPets", selected)} />
          </Field>
          <Field label="Frequência Desejada">
            <OptionChips options={frequencyOptions} value={formData.desiredFrequency} onChange={(selected) => updateField("desiredFrequency", selected)} />
          </Field>
        </Section>

        <Section
          complete={securityComplete}
          hint="Crie uma senha segura e confirme os dados antes de seguir para a escolha do plano."
          onToggle={() => setOpenSection((prev) => (prev === "security" ? "" : "security"))}
          open={openSection === "security"}
          title="Segurança"
        >
          <TextField label="Senha" error={errors.password} value={formData.password} onChangeText={(text) => updateField("password", text)} placeholder="Digite uma senha segura" secureTextEntry />
          <TextField label="Confirmar Senha" error={errors.confirmPassword} value={formData.confirmPassword} onChangeText={(text) => updateField("confirmPassword", text)} placeholder="Confirme sua senha" secureTextEntry />
        </Section>

        <TouchableOpacity disabled={isLoading} onPress={submit} style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled, { marginTop: 4 }]}>
          {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Criar conta e escolher plano</Text>}
        </TouchableOpacity>
      </ScrollView>

      <MapConfirmModal
        visible={showMap}
        coords={mapCoords}
        onClose={() => setShowMap(false)}
        onConfirm={({ latitude, longitude }) => {
          setFormData((prev) => ({ ...prev, latitude, longitude }));
          setCepMessage({ type: "success", text: "Localização confirmada! Você pode prosseguir com o registro." });
        }}
      />
    </>
  );
}

function RegisterDiaristForm({ onBack, onComplete }) {
  const [openSection, setOpenSection] = useState("personal");
  const [formData, setFormData] = useState(initialDiaristData);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapCoords, setMapCoords] = useState(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState(null);

  const personalInfoComplete =
    formData.name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(formData.email) &&
    normalizePhone(formData.phone).length >= 10 &&
    normalizeCpf(formData.cpf).length === 11;
  const addressComplete =
    formData.zip.length === 8 &&
    Boolean(formData.street.trim()) &&
    Boolean(formData.number.trim()) &&
    Boolean(formData.neighborhood.trim()) &&
    Boolean(formData.city.trim()) &&
    Boolean(formData.state.trim()) &&
    formData.latitude !== 0 &&
    formData.longitude !== 0;
  const professionalComplete =
    formData.bio.trim().length >= 10 &&
    String(formData.experienceYears).trim() !== "" &&
    Number(formData.experienceYears) >= 0 &&
    Number(formData.pricePerHour) > 0 &&
    Number(formData.pricePerDay) > 0 &&
    formData.specialties.length > 0;
  const securityComplete =
    formData.password.length >= 6 &&
    formData.confirmPassword.length >= 6 &&
    formData.password === formData.confirmPassword;

  const canEditAddressFields = cepMessage?.type === "error";

  const validateForm = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Nome é obrigatório";
    else if (formData.name.trim().length < 2) nextErrors.name = "Nome deve ter pelo menos 2 caracteres";
    if (!formData.email.trim()) nextErrors.email = "E-mail é obrigatório";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) nextErrors.email = "E-mail inválido";
    if (!formData.phone.trim()) nextErrors.phone = "Telefone é obrigatório";
    else if (normalizePhone(formData.phone).length < 10) nextErrors.phone = "Telefone deve ter pelo menos 10 dígitos";
    if (!formData.cpf.trim()) nextErrors.cpf = "CPF é obrigatório";
    else if (normalizeCpf(formData.cpf).length !== 11) nextErrors.cpf = "CPF deve ter 11 dígitos";
    if (!formData.zip.trim()) nextErrors.zip = "CEP é obrigatório";
    else if (formData.zip.length !== 8) nextErrors.zip = "CEP deve ter 8 dígitos";
    if (!formData.street.trim()) nextErrors.street = "Rua é obrigatória";
    if (!formData.number.trim()) nextErrors.number = "Número é obrigatório";
    if (!formData.city.trim()) nextErrors.city = "Cidade é obrigatória";
    if (!formData.state.trim()) nextErrors.state = "Estado é obrigatório";
    if (formData.latitude === 0 || formData.longitude === 0) nextErrors.location = "Localize seu endereço no mapa antes de prosseguir";
    if (!formData.bio.trim()) nextErrors.bio = "Bio/resumo profissional é obrigatório";
    else if (formData.bio.trim().length < 10) nextErrors.bio = "Bio deve ter pelo menos 10 caracteres";
    if (!formData.experienceYears) nextErrors.experienceYears = "Anos de experiência é obrigatório";
    else if (Number.isNaN(Number(formData.experienceYears)) || Number(formData.experienceYears) < 0) nextErrors.experienceYears = "Insira um número válido";
    if (!formData.pricePerHour) nextErrors.pricePerHour = "Preço por hora é obrigatório";
    else if (Number.isNaN(Number(formData.pricePerHour)) || Number(formData.pricePerHour) <= 0) nextErrors.pricePerHour = "Insira um valor válido (maior que 0)";
    if (!formData.pricePerDay) nextErrors.pricePerDay = "Preço por diária é obrigatório";
    else if (Number.isNaN(Number(formData.pricePerDay)) || Number(formData.pricePerDay) <= 0) nextErrors.pricePerDay = "Insira um valor válido (maior que 0)";
    if (formData.specialties.length === 0) nextErrors.specialties = "Selecione pelo menos uma especialidade";
    if (!formData.password.trim()) nextErrors.password = "Senha é obrigatória";
    else if (formData.password.length < 6) nextErrors.password = "Senha deve ter pelo menos 6 caracteres";
    if (!formData.confirmPassword.trim()) nextErrors.confirmPassword = "Confirmação de senha é obrigatória";
    else if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = "As senhas não correspondem";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleZipCode = async (zip) => {
    setCepLoading(true);
    setCepMessage(null);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
      const data = await response.json();
      if (data?.erro) {
        setCepMessage({ type: "error", text: "CEP não encontrado. Confira os dígitos." });
        return;
      }
      setFormData((prev) => ({
        ...prev,
        street: data.logradouro || "",
        neighborhood: data.bairro || "",
        city: data.localidade || "",
        state: (data.uf || "").toUpperCase(),
      }));
      setCepMessage({ type: "info", text: "CEP encontrado! Buscando localização..." });
      const params = new URLSearchParams({
        q: [data.logradouro, data.bairro, data.localidade, data.uf, "Brasil"].filter(Boolean).join(", "),
        format: "jsonv2",
        limit: "1",
        countrycodes: "br",
      });
      const nominatimRes = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
      const nominatimData = await nominatimRes.json();
      if (Array.isArray(nominatimData) && nominatimData.length > 0) {
        const match = nominatimData[0];
        const lat = Number(match.lat);
        const lon = Number(match.lon);
        setMapCoords({ lat, lon });
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lon }));
        setCepMessage({ type: "success", text: "Localização encontrada! Confirme no mapa." });
        setShowMap(true);
      } else {
        setCepMessage({ type: "warning", text: "Não consegui localizar no mapa. Tente confirmar manualmente." });
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      setCepMessage({ type: "error", text: "Erro ao buscar CEP. Tente novamente." });
    } finally {
      setCepLoading(false);
    }
  };

  const updateField = (name, value) => {
    const cleanValue = name === "zip" ? value.replace(/\D/g, "").slice(0, 8) : value;
    const affectsLocation = ["zip", "street", "number", "neighborhood", "city", "state"].includes(name);

    setFormData((prev) => ({
      ...prev,
      [name]: cleanValue,
      ...(affectsLocation ? { latitude: 0, longitude: 0 } : {}),
    }));

    if (affectsLocation) {
      setMapCoords(null);
      if (name !== "zip") {
        setCepMessage({ type: "warning", text: "Endereço alterado. Confirme novamente a localização no mapa." });
      }
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (name === "zip" && cleanValue.length === 8) {
      void handleZipCode(cleanValue);
    }
  };

  const toggleSpecialty = (specialtyId) => {
    setFormData((prev) => {
      const isSelected = prev.specialties.includes(specialtyId);
      return {
        ...prev,
        specialties: isSelected
          ? prev.specialties.filter((id) => id !== specialtyId)
          : [...prev.specialties, specialtyId],
      };
    });
    if (errors.specialties) {
      setErrors((prev) => ({ ...prev, specialties: "" }));
    }
  };

  const submit = async () => {
    if (!validateForm()) {
      return;
    }
    setIsLoading(true);
    setErrors({});
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: parseInt(normalizePhone(formData.phone), 10),
        cpf: formData.cpf,
        password: formData.password,
        role: "diarista",
        address: {
          street: formData.street,
          number: formData.number,
          neighborhood: formData.neighborhood,
          complement: formData.complement,
          referencePoint: formData.referencePoint,
          city: formData.city,
          state: formData.state,
          zipcode: formData.zip,
          latitude: formData.latitude,
          longitude: formData.longitude,
        },
        diarist_profile: {
          bio: formData.bio,
          experience_years: parseInt(formData.experienceYears, 10),
          price_per_hour: parseFloat(formData.pricePerHour),
          price_per_day: parseFloat(formData.pricePerDay),
          specialties: formData.specialties,
          available: formData.available,
        },
      };
      await onComplete(payload);
    } catch (error) {
      setErrors({ general: error.message || "Não foi possível concluir o cadastro." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backLink}>
            <Feather name="arrow-left" size={16} color={palette.accent} />
            <Text style={styles.backLinkText}>Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>Registre-se como Diarista</Text>
          <Text style={styles.formCopy}>Comece a oferecer seus serviços de limpeza.</Text>
        </View>

        {errors.general ? <StatusCard type="error" text={errors.general} /> : null}

        <Section
          complete={personalInfoComplete}
          hint="Preencha seus dados principais para criar o seu perfil profissional."
          onToggle={() => setOpenSection((prev) => (prev === "personal" ? "" : "personal"))}
          open={openSection === "personal"}
          title="Dados Pessoais"
        >
          <TextField label="Nome Completo" error={errors.name} value={formData.name} onChangeText={(text) => updateField("name", text)} placeholder="Digite seu nome completo" />
          <TextField label="E-mail" error={errors.email} value={formData.email} onChangeText={(text) => updateField("email", text)} placeholder="Digite seu e-mail" keyboardType="email-address" />
          <TextField label="Telefone" error={errors.phone} value={formData.phone} onChangeText={(text) => updateField("phone", text)} placeholder="(11) 99999-9999" keyboardType="phone-pad" />
          <TextField label="CPF" error={errors.cpf} value={formData.cpf} onChangeText={(text) => updateField("cpf", text)} placeholder="000.000.000-00" keyboardType="number-pad" />
        </Section>

        <Section
          complete={addressComplete}
          hint="Use o CEP para preencher o endereço automaticamente e depois confirme a localização no mapa."
          onToggle={() => setOpenSection((prev) => (prev === "address" ? "" : "address"))}
          open={openSection === "address"}
          title="Endereço"
        >
          <TextField label="CEP" error={errors.zip} value={maskZip(formData.zip)} onChangeText={(text) => updateField("zip", text)} placeholder="00000-000" keyboardType="number-pad" />
          {cepLoading ? <Text style={styles.fieldHint}>Buscando...</Text> : null}
          {cepMessage ? <StatusCard type={cepMessage.type} text={cepMessage.text} /> : null}
          <TextField label="Rua" error={errors.street} value={formData.street} onChangeText={(text) => updateField("street", text)} placeholder="Digite sua rua" editable={canEditAddressFields} />
          <TextField label="Número" error={errors.number} value={formData.number} onChangeText={(text) => updateField("number", text)} placeholder="Digite o número" />
          <TextField label="Bairro" value={formData.neighborhood} onChangeText={(text) => updateField("neighborhood", text)} placeholder="Digite seu bairro" editable={canEditAddressFields} />
          <TextField label="Complemento" value={formData.complement} onChangeText={(text) => updateField("complement", text)} placeholder="Apto, bloco, etc." />
          <TextField label="Ponto de Referência" value={formData.referencePoint} onChangeText={(text) => updateField("referencePoint", text)} placeholder="Próximo a..." />
          <TextField label="Cidade" error={errors.city} value={formData.city} onChangeText={(text) => updateField("city", text)} placeholder="Digite sua cidade" editable={canEditAddressFields} />
          <TextField label="Estado" error={errors.state} value={formData.state} onChangeText={(text) => updateField("state", text.toUpperCase())} placeholder="SP" editable={canEditAddressFields} />
          {(formData.latitude !== 0 || formData.longitude !== 0) ? (
            <TouchableOpacity onPress={() => setShowMap(true)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Ajustar localização no mapa</Text>
            </TouchableOpacity>
          ) : null}
          {errors.location ? <Text style={styles.fieldError}>{errors.location}</Text> : null}
        </Section>

        <Section
          complete={professionalComplete}
          hint="Mostre sua experiência e defina seus valores para transmitir mais confiança logo no cadastro."
          onToggle={() => setOpenSection((prev) => (prev === "professional" ? "" : "professional"))}
          open={openSection === "professional"}
          title="Perfil Profissional"
        >
          <TextField label="Bio / Resumo Profissional" error={errors.bio} value={formData.bio} onChangeText={(text) => updateField("bio", text)} placeholder="Descreva sua experiência, seus diferenciais e os serviços que mais realiza" multiline numberOfLines={5} />
          <TextField label="Anos de Experiência" error={errors.experienceYears} value={formData.experienceYears} onChangeText={(text) => updateField("experienceYears", text)} placeholder="Ex.: 5" keyboardType="number-pad" />
          <TextField label="Preço por Hora (R$)" error={errors.pricePerHour} value={formData.pricePerHour} onChangeText={(text) => updateField("pricePerHour", text)} placeholder="Ex.: 50.00" keyboardType="decimal-pad" />
          <TextField label="Preço por Diária (R$)" error={errors.pricePerDay} value={formData.pricePerDay} onChangeText={(text) => updateField("pricePerDay", text)} placeholder="Ex.: 200.00" keyboardType="decimal-pad" />
          <Field label="Especialidades" error={errors.specialties} hint="Selecione os serviços que você oferece:">
            <OptionChips options={specialtyOptions} value={formData.specialties} onChange={toggleSpecialty} multiple />
          </Field>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.label}>Disponível para novos serviços</Text>
              <Text style={styles.fieldHint}>Seu perfil pode receber novas solicitações assim que a conta for ativada.</Text>
            </View>
            <Switch value={formData.available} onValueChange={(value) => updateField("available", value)} />
          </View>
        </Section>

        <Section
          complete={securityComplete}
          hint="Use uma senha com pelo menos 6 caracteres."
          onToggle={() => setOpenSection((prev) => (prev === "security" ? "" : "security"))}
          open={openSection === "security"}
          title="Segurança"
        >
          <TextField label="Senha" error={errors.password} value={formData.password} onChangeText={(text) => updateField("password", text)} placeholder="Digite uma senha segura" secureTextEntry />
          <TextField label="Confirmar Senha" error={errors.confirmPassword} value={formData.confirmPassword} onChangeText={(text) => updateField("confirmPassword", text)} placeholder="Confirme sua senha" secureTextEntry />
        </Section>

        <TouchableOpacity disabled={isLoading} onPress={submit} style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled, { marginTop: 4 }]}>
          {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Criar conta e escolher plano</Text>}
        </TouchableOpacity>
      </ScrollView>

      <MapConfirmModal
        visible={showMap}
        coords={mapCoords}
        onClose={() => setShowMap(false)}
        onConfirm={({ latitude, longitude }) => {
          setFormData((prev) => ({ ...prev, latitude, longitude }));
          setCepMessage({ type: "success", text: "Localização confirmada! Você pode prosseguir com o registro." });
        }}
      />
    </>
  );
}

export default function RegisterFlow({ onBackToLogin, onRegistrationSuccess }) {
  const [role, setRole] = useState("");
  const [processingPlanId, setProcessingPlanId] = useState("");
  const [planError, setPlanError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [step, setStep] = useState("role");

  const resetFlow = () => {
    setRole("");
    setStep("role");
    setRegisterError("");
    setPlanError("");
  };

  const handleRegistrationComplete = async (payload) => {
    setRegisterError("");
    const response = await fetch(buildApiUrl("/register"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const registerPayload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(registerPayload.error || "Erro ao realizar registro");
    }

    if (!isStripeConfigured) {
      onRegistrationSuccess(registerPayload?.message || "Registro concluído com sucesso! Confira seu e-mail para confirmar a conta.");
      onBackToLogin();
      return;
    }

    const loginResponse = await fetch(buildApiUrl("/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
      }),
    });

    const loginPayload = await loginResponse.json().catch(() => ({}));
    if (!loginResponse.ok || !loginPayload?.token) {
      throw new Error(loginPayload.error || "Registro concluído, mas o login automático falhou.");
    }

    await setToken(loginPayload.token);
    setStep("plans");
  };

  const handlePlanSelected = async (plan) => {
    setPlanError("");
    setProcessingPlanId(plan.id);

    try {
      const response = await apiFetch("/subscriptions/checkout-session", {
        method: "POST",
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: plan.id }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível iniciar o checkout da assinatura.");
      }

      if (payload?.url) {
        await Linking.openURL(payload.url);
        return;
      }

      if (payload?.session_id) {
        throw new Error("O checkout retornou uma sessão Stripe web. Precisamos ligar a etapa mobile do pagamento na próxima iteração.");
      }

      throw new Error("Checkout não retornou a URL esperada.");
    } catch (error) {
      setPlanError(error.message || "Não foi possível iniciar a assinatura.");
    } finally {
      setProcessingPlanId("");
    }
  };

  const form = useMemo(() => {
    if (step === "plans") {
      return (
        <PlanSelectionNative
          error={planError}
          onBack={() => setStep(role ? role : "role")}
          onPlanSelected={handlePlanSelected}
          processingPlanId={processingPlanId}
        />
      );
    }

    if (role === "cliente") {
      return (
        <RegisterClientForm
          onBack={resetFlow}
          onComplete={handleRegistrationComplete}
        />
      );
    }

    if (role === "diarista") {
      return (
        <RegisterDiaristForm
          onBack={resetFlow}
          onComplete={handleRegistrationComplete}
        />
      );
    }

    return (
      <RoleSelection
        onBackToLogin={onBackToLogin}
        onSelectRole={(nextRole) => {
          setRole(nextRole);
          setStep(nextRole);
        }}
      />
    );
  }, [handlePlanSelected, onBackToLogin, planError, processingPlanId, role, step]);

  return (
    <View style={styles.screen}>
      {registerError ? <StatusCard text={registerError} type="error" /> : null}
      {form}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  roleHeader: {
    marginBottom: 18,
    alignItems: "center",
    gap: 6,
  },
  roleTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  roleCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  roleCard: {
    borderRadius: 16,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
    marginBottom: 12,
    alignItems: "center",
  },
  roleEmoji: {
    fontSize: 30,
    marginBottom: 12,
  },
  roleCardTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  roleCardCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  formHeader: {
    gap: 8,
    marginBottom: 16,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  backLinkText: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  formTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "800",
  },
  formCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    borderRadius: 16,
    backgroundColor: palette.surface,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
  },
  sectionToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  sectionToggleOpen: {
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  sectionCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionHint: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionMeta: {
    alignItems: "flex-end",
    gap: 8,
  },
  sectionStatus: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sectionStatusComplete: {
    backgroundColor: "#dcfce7",
  },
  sectionStatusPending: {
    backgroundColor: "#f3f4f6",
  },
  sectionStatusText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionStatusTextComplete: {
    color: "#166534",
  },
  sectionPanel: {
    padding: 16,
    gap: 12,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  fieldHint: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: palette.ink,
    fontSize: 15,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  inputReadonly: {
    backgroundColor: "#f8fafc",
    color: "#64748b",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  fieldError: {
    color: palette.error,
    fontSize: 12,
    lineHeight: 17,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  chipIcon: {
    fontSize: 15,
  },
  chipText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextSelected: {
    color: "#ffffff",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#ffffff",
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  statusCard: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
  },
  statusError: {
    backgroundColor: palette.errorBg,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  statusSuccess: {
    backgroundColor: palette.successBg,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  statusWarning: {
    backgroundColor: palette.warningBg,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  statusInfo: {
    backgroundColor: palette.infoBg,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  statusErrorText: {
    color: palette.error,
    fontSize: 13,
    lineHeight: 18,
  },
  statusSuccessText: {
    color: palette.success,
    fontSize: 13,
    lineHeight: 18,
  },
  statusWarningText: {
    color: palette.warning,
    fontSize: 13,
    lineHeight: 18,
  },
  statusInfoText: {
    color: palette.info,
    fontSize: 13,
    lineHeight: 18,
  },
  roomsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
  },
  roomsToggleTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  subSection: {
    gap: 12,
  },
  inlineBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subSectionTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  subSectionHint: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 240,
  },
  smallButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.accent,
  },
  smallButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.border,
    borderRadius: 12,
    padding: 14,
  },
  emptyCardText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  roomCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: "#fef2f2",
  },
  removeButtonText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "700",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  planCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#ffffff",
    padding: 18,
    marginBottom: 12,
  },
  planBadge: {
    alignSelf: "flex-start",
    marginBottom: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: palette.accentSoft,
    color: palette.accent,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  planName: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  planPrice: {
    color: palette.accent,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 10,
  },
  planPeriod: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  planOriginal: {
    color: palette.muted,
    fontSize: 13,
    textDecorationLine: "line-through",
    marginTop: 3,
  },
  planDescription: {
    color: palette.ink,
    fontSize: 14,
    marginTop: 10,
    marginBottom: 10,
  },
  planFeature: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
});
