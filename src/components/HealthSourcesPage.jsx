import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Platform, Linking } from 'react-native';
import { TOPICS, HEALTH_DISCLAIMER, sourcesFor } from '../lib/healthSources';

const INK = '#16201b';
const INK500 = '#6c7872';
const INK400 = '#97a19b';
const LINE = '#e9e9e1';
const GREEN = '#059669';

const openUrl = (url) => Linking.openURL(url).catch(() => {});

// One tappable citation: title, who published it, opens the source in the browser.
export const SourceItem = ({ source, last }) => (
  <TouchableOpacity
    style={[styles.source, last && { borderBottomWidth: 0 }]}
    onPress={() => openUrl(source.url)}
    activeOpacity={0.7}
    accessibilityRole="link"
    accessibilityLabel={`${source.title}. ${source.by}. Opens in your browser.`}
  >
    <View style={{ flex: 1, paddingRight: 10 }}>
      <Text style={styles.sourceTitle}>{source.title}</Text>
      <Text style={styles.sourceBy}>{source.by}</Text>
    </View>
    <Ionicons name="open-outline" size={16} color={GREEN} />
  </TouchableOpacity>
);

// Citations block for the end of an article or insight.
export const SourceList = ({ ids, heading = 'Sources' }) => {
  const list = sourcesFor(ids);
  if (!list.length) return null;
  return (
    <View style={styles.inlineWrap}>
      <Text style={styles.inlineHeading}>{heading}</Text>
      {list.map((s, i) => <SourceItem key={s.url} source={s} last={i === list.length - 1} />)}
    </View>
  );
};

// "Health info & sources": where every health number and piece of advice in Logga comes from (guideline 1.4.1).
// `topic` puts that section first, so a screen can open the page at its own subject.
const HealthSourcesPage = ({ visible, onClose, topic }) => {
  const ordered = topic
    ? [...TOPICS.filter((t) => t.id === topic), ...TOPICS.filter((t) => t.id !== topic)]
    : TOPICS;
  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={[styles.page, Platform.OS === 'android' && { paddingTop: 44 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Health info & sources</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            The numbers, goals and tips in Logga are based on published research and public health guidance. Tap a source to read it.
          </Text>
          {ordered.map((t) => {
            const list = sourcesFor(t.sources);
            return (
              <View key={t.id} style={styles.topic}>
                <Text style={styles.topicTitle}>{t.title}</Text>
                <Text style={styles.topicSummary}>{t.summary}</Text>
                <View style={styles.sourceCard}>
                  {list.map((s, i) => <SourceItem key={s.url} source={s} last={i === list.length - 1} />)}
                </View>
              </View>
            );
          })}
          <View style={styles.disclaimer}>
            <Ionicons name="medkit-outline" size={18} color={INK500} style={{ marginTop: 1 }} />
            <Text style={styles.disclaimerTxt}>{HEALTH_DISCLAIMER}</Text>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

// Small "Sources" link that opens the page at a topic. Drop it under any health number.
export const SourcesLink = ({ topic, label = 'Sources', style, color = GREEN }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.link, style]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Health info and sources"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="book-outline" size={13} color={color} />
        <Text style={[styles.linkTxt, { color }]}>{label}</Text>
      </TouchableOpacity>
      <HealthSourcesPage visible={open} onClose={() => setOpen(false)} topic={topic} />
    </>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: INK },
  content: { paddingHorizontal: 20, paddingTop: 18, width: '100%', maxWidth: 640, alignSelf: 'center' },
  intro: { fontSize: 14.5, lineHeight: 21, color: INK500, marginBottom: 6 },
  topic: { marginTop: 22 },
  topicTitle: { fontSize: 17, fontWeight: '800', color: INK, letterSpacing: -0.2 },
  topicSummary: { fontSize: 14, lineHeight: 20, color: INK500, marginTop: 6 },
  sourceCard: { marginTop: 10, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, paddingHorizontal: 14 },
  source: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: LINE },
  sourceTitle: { fontSize: 13.5, lineHeight: 18, fontWeight: '600', color: INK },
  sourceBy: { fontSize: 12, lineHeight: 16, color: INK400, marginTop: 2 },
  disclaimer: { flexDirection: 'row', gap: 10, marginTop: 28, padding: 14, borderRadius: 14, backgroundColor: '#F1F5F2' },
  disclaimerTxt: { flex: 1, fontSize: 13, lineHeight: 19, color: INK500 },
  inlineWrap: { marginTop: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: LINE },
  inlineHeading: { fontSize: 11.5, fontWeight: '800', color: INK400, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  linkTxt: { fontSize: 12.5, fontWeight: '700' },
});

export default HealthSourcesPage;
