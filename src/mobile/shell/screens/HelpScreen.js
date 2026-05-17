import React, { useMemo, useState } from "react";
import { Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { styles, palette } from "../AppShell.styles";
import { flattenHelpItems, getHelpTopics, HELP_SUPPORT_EMAIL } from "../content/helpContent";

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function HelpSurfaceCard({ children, style }) {
  return <View style={[styles.helpSurfaceCard, style]}>{children}</View>;
}

export default function HelpScreen({ session, onBack }) {
  const [search, setSearch] = useState("");
  const [activeTopicId, setActiveTopicId] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);

  const topics = useMemo(() => getHelpTopics(session?.role), [session?.role]);
  const normalizedSearch = normalizeSearchText(search);
  const isBrowsingTopics = !normalizedSearch && !activeTopicId;

  const activeTopic = useMemo(
    () => topics.find((topic) => topic.id === activeTopicId) || null,
    [activeTopicId, topics],
  );

  const visibleTopics = useMemo(() => {
    return topics
      .map((topic) => {
        const items = topic.items.filter((item) => {
          if (activeTopicId && topic.id !== activeTopicId) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          const haystack = normalizeSearchText(`${item.question} ${item.answer} ${topic.label}`);
          return haystack.includes(normalizedSearch);
        });

        return { ...topic, items };
      })
      .filter((topic) => topic.items.length > 0);
  }, [activeTopicId, normalizedSearch, topics]);

  const flatResults = useMemo(
    () =>
      visibleTopics.flatMap((topic) =>
        topic.items.map((item) => ({
          ...item,
          topicId: topic.id,
          topicLabel: topic.label,
          topicIcon: topic.icon,
        })),
      ),
    [visibleTopics],
  );

  const resultCount = flatResults.length;
  const popularItems = useMemo(() => flattenHelpItems(topics).slice(0, 4), [topics]);

  const faqSectionTitle = activeTopic?.label || (normalizedSearch ? "Resultados da busca" : "Perguntas frequentes");

  const handleContactEmail = () => {
    const subject = encodeURIComponent("Ajuda Limpae - suporte no app");
    const body = encodeURIComponent(
      `Olá, equipe Limpae.\n\nPreciso de ajuda com:\n\nPapel: ${session?.role || "não informado"}\n\nDescreva seu problema aqui.`,
    );
    void Linking.openURL(`mailto:${HELP_SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const openTopic = (topicId) => {
    setActiveTopicId(topicId);
    setExpandedKey(null);
  };

  const resetBrowse = () => {
    setActiveTopicId(null);
    setExpandedKey(null);
    setSearch("");
  };

  const toggleExpanded = (key) => {
    setExpandedKey((current) => (current === key ? null : key));
  };

  const openPopularItem = (item) => {
    setActiveTopicId(item.topicId);
    setExpandedKey(`${item.topicId}-${item.question}`);
    setSearch("");
  };

  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={styles.helpScreenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.helpHeader}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onBack}
          style={styles.helpBackButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Feather name="arrow-left" size={20} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.helpHeaderCopy}>
          <Text style={styles.helpHeaderKicker}>Central de ajuda</Text>
          <Text style={styles.helpHeaderTitle}>Como podemos ajudar?</Text>
        </View>
      </View>

      <HelpSurfaceCard style={styles.helpHeroCard}>
        <View style={styles.helpSearchWrap}>
          <Feather name="search" size={18} color={palette.muted} />
          <TextInput
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              if (value.trim()) {
                setActiveTopicId(null);
              }
            }}
            placeholder="Buscar por assunto, ex.: pagamento, oferta..."
            placeholderTextColor="#9ca3af"
            style={styles.helpSearchInput}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} activeOpacity={0.8}>
              <Feather name="x-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {!isBrowsingTopics ? (
          <TouchableOpacity activeOpacity={0.85} onPress={resetBrowse} style={styles.helpResetTopics}>
            <Feather name="grid" size={14} color={palette.accent} />
            <Text style={styles.helpResetTopicsText}>Ver todos os temas</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.helpHeroHint}>Escolha um tema ou busque pela sua dúvida</Text>
        )}
      </HelpSurfaceCard>

      {isBrowsingTopics ? (
        <>
          <Text style={styles.helpSectionLabel}>Mais acessados</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.helpPopularRow}
          >
            {popularItems.map((item) => {
              const key = `${item.topicId}-${item.question}`;
              return (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.9}
                  onPress={() => openPopularItem(item)}
                  style={styles.helpPopularCard}
                >
                  <View style={styles.helpPopularIconWrap}>
                    <Feather name={item.topicIcon} size={16} color={palette.accent} />
                  </View>
                  <Text style={styles.helpPopularCardTitle} numberOfLines={3}>
                    {item.question}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.helpSectionLabel}>Temas de ajuda</Text>
          <HelpSurfaceCard style={styles.helpTopicsCard}>
            {topics.map((topic, index) => (
              <TouchableOpacity
                key={topic.id}
                activeOpacity={0.88}
                onPress={() => openTopic(topic.id)}
                style={[styles.helpTopicRow, index > 0 && styles.helpTopicRowBorder]}
              >
                <View style={styles.helpTopicRowIcon}>
                  <Feather name={topic.icon} size={18} color={palette.accent} />
                </View>
                <View style={styles.helpTopicRowCopy}>
                  <Text style={styles.helpTopicRowTitle}>{topic.label}</Text>
                  <Text style={styles.helpTopicRowMeta}>
                    {topic.items.length} {topic.items.length === 1 ? "artigo" : "artigos"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </HelpSurfaceCard>
        </>
      ) : null}

      {!isBrowsingTopics ? (
        <>
          <View style={styles.helpFaqHeader}>
            <View style={styles.helpFaqHeaderMain}>
              {activeTopic ? (
                <View style={styles.helpFaqTopicBadge}>
                  <Feather name={activeTopic.icon} size={14} color={palette.accent} />
                </View>
              ) : (
                <View style={styles.helpFaqTopicBadge}>
                  <Feather name="search" size={14} color={palette.accent} />
                </View>
              )}
              <View style={styles.helpFaqHeaderCopy}>
                <Text style={styles.helpFaqHeaderTitle}>{faqSectionTitle}</Text>
                <Text style={styles.helpFaqHeaderMeta}>
                  {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
                </Text>
              </View>
            </View>
          </View>

          {resultCount === 0 ? (
            <HelpSurfaceCard>
              <View style={styles.helpEmptyState}>
                <View style={styles.helpEmptyIconWrap}>
                  <Feather name="inbox" size={22} color={palette.accent} />
                </View>
                <Text style={styles.helpEmptyTitle}>Nenhum resultado encontrado</Text>
                <Text style={styles.helpEmptyCopy}>
                  Tente outra palavra-chave ou escolha um tema na lista completa.
                </Text>
                <TouchableOpacity activeOpacity={0.9} onPress={resetBrowse} style={styles.helpEmptyButton}>
                  <Text style={styles.helpEmptyButtonText}>Ver todos os temas</Text>
                </TouchableOpacity>
              </View>
            </HelpSurfaceCard>
          ) : (
            <HelpSurfaceCard style={styles.helpFaqCard}>
              {flatResults.map((item, index) => {
                const key = `${item.topicId}-${item.question}`;
                const isOpen = expandedKey === key;

                return (
                  <View
                    key={key}
                    style={[styles.helpFaqItem, index > 0 && styles.helpFaqItemBorder]}
                  >
                    {!activeTopic ? (
                      <View style={styles.helpFaqTopicTag}>
                        <Feather name={item.topicIcon} size={12} color={palette.accent} />
                        <Text style={styles.helpFaqTopicTagText}>{item.topicLabel}</Text>
                      </View>
                    ) : null}
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => toggleExpanded(key)}
                      style={styles.helpFaqQuestionRow}
                    >
                      <Text style={styles.helpFaqQuestion}>{item.question}</Text>
                      <View style={[styles.helpFaqChevronWrap, isOpen && styles.helpFaqChevronWrapOpen]}>
                        <Feather
                          name={isOpen ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={isOpen ? palette.accent : palette.muted}
                        />
                      </View>
                    </TouchableOpacity>
                    {isOpen ? (
                      <View style={styles.helpFaqAnswerBox}>
                        <Text style={styles.helpFaqAnswer}>{item.answer}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </HelpSurfaceCard>
          )}
        </>
      ) : null}

      <HelpSurfaceCard style={styles.helpSupportCard}>
        <View style={styles.helpSupportHeader}>
          <View style={styles.helpSupportIconWrap}>
            <Feather name="headphones" size={20} color={palette.accent} />
          </View>
          <View style={styles.helpSupportHeaderCopy}>
            <Text style={styles.helpSupportTitle}>Ainda precisa de ajuda?</Text>
            <Text style={styles.helpSupportSubtitle}>Atendimento por e-mail em horário comercial</Text>
          </View>
        </View>

        <Text style={styles.helpSupportCopy}>
          Envie prints, data do serviço e uma descrição curta do problema para agilizar a resposta.
        </Text>

        <TouchableOpacity activeOpacity={0.9} onPress={handleContactEmail} style={styles.helpSupportButton}>
          <Feather name="mail" size={18} color="#ffffff" />
          <Text style={styles.helpSupportButtonText}>Enviar e-mail ao suporte</Text>
        </TouchableOpacity>

        <Text style={styles.helpSupportEmail}>{HELP_SUPPORT_EMAIL}</Text>
      </HelpSurfaceCard>
    </ScrollView>
  );
}
