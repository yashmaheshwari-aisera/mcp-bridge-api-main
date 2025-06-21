import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { Button, TextInput, Text, Snackbar, Card, Title, useTheme, RadioButton, Divider, Dialog, Portal, Switch, Chip, Banner, IconButton } from 'react-native-paper';
import { mcpBridgeAPI } from '../services/api';
import { geminiAPI } from '../services/gemini';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentConfig, resetToDefaults } from '../services/autoConfig';

// Define available Gemini models based on the latest documentation
const GEMINI_MODELS = [
  {
    name: 'Gemini 2.5 Flash Preview 05-20',
    value: 'gemini-2.5-flash-preview-05-20',
    description: 'Audio, images, videos, and text | Adaptive thinking, cost efficiency',
    category: 'Latest',
    isDefault: true
  },
  {
    name: 'Gemini 2.5 Pro Preview',
    value: 'gemini-2.5-pro-preview-05-06',
    description: 'Enhanced thinking and reasoning, multimodal understanding, advanced coding',
    category: 'Latest'
  },
  {
    name: 'Gemini 2.0 Flash',
    value: 'gemini-2.0-flash',
    description: 'Next generation features, speed, thinking, and realtime streaming',
    category: 'Stable'
  },
  {
    name: 'Gemini 2.0 Flash Preview Image Generation',
    value: 'gemini-2.0-flash-preview-image-generation',
    description: 'Conversational image generation and editing',
    category: 'Preview'
  },
  {
    name: 'Gemini 2.0 Flash-Lite',
    value: 'gemini-2.0-flash-lite',
    description: 'Cost efficiency and low latency',
    category: 'Stable'
  },
  {
    name: 'Gemini 1.5 Flash',
    value: 'gemini-1.5-flash',
    description: 'Fast and versatile performance across a diverse variety of tasks',
    category: 'Stable'
  },
  {
    name: 'Gemini 1.5 Flash-8B',
    value: 'gemini-1.5-flash-8b',
    description: 'High volume and lower intelligence tasks',
    category: 'Stable'
  },
  {
    name: 'Gemini 1.5 Pro',
    value: 'gemini-1.5-pro',
    description: 'Complex reasoning tasks requiring more intelligence',
    category: 'Stable'
  },
  {
    name: 'Custom Model',
    value: 'custom',
    description: 'Specify your own model name',
    category: 'Custom'
  }
];

export default function Settings() {
  const theme = useTheme();
  const [mcpBridgeUrl, setMcpBridgeUrl] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<{ status?: string; serverCount?: number; servers?: any[] } | null>(null);
  
  // Configuration status tracking
  const [isUsingDefaults, setIsUsingDefaults] = useState({ 
    apiKey: false, 
    bridgeUrl: false, 
    model: false 
  });
  const [showConfigBanner, setShowConfigBanner] = useState(true);
  
  // Model selection state
  const [selectedModelValue, setSelectedModelValue] = useState('gemini-1.5-flash');
  const [showModelsDialog, setShowModelsDialog] = useState(false);
  const [customModelName, setCustomModelName] = useState('');

  useEffect(() => {
    // Load saved settings
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      console.log('📋 Loading settings from UI...');
      
      // Get current configuration to check if using defaults
      const currentConfig = await getCurrentConfig();
      
      // Default values for comparison - using empty string for API key to indicate no default
      const defaults = {
        apiKey: '', // No default API key - must be configured
        bridgeUrl: 'http://localhost:3000',
        model: 'gemini-1.5-flash'
      };
      
      // Load MCP Bridge URL
      const savedUrl = await mcpBridgeAPI.getBaseUrl();
      if (savedUrl) {
        setMcpBridgeUrl(savedUrl);
        checkHealth();
      }

      // Load Gemini settings
      const savedApiKey = await geminiAPI.getApiKey();
      if (savedApiKey) {
        setGeminiApiKey(savedApiKey);
      }

      const savedModel = await geminiAPI.getModelName();
      if (savedModel) {
        setGeminiModel(savedModel);
        
        // Find if it's one of our predefined models
        const matchedModel = GEMINI_MODELS.find(model => model.value === savedModel);
        if (matchedModel) {
          setSelectedModelValue(matchedModel.value);
        } else {
          // If it's not a predefined model, set to custom
          setSelectedModelValue('custom');
          setCustomModelName(savedModel);
        }
      }
      
      // Check if using default values
      const defaultStatus = {
        apiKey: savedApiKey === defaults.apiKey,
        bridgeUrl: savedUrl === defaults.bridgeUrl,
        model: savedModel === defaults.model
      };
      
      setIsUsingDefaults(defaultStatus);
      
      // Show banner if any defaults are being used
      const usingAnyDefaults = Object.values(defaultStatus).some(isDefault => isDefault);
      setShowConfigBanner(usingAnyDefaults);
      
      console.log('📊 Configuration status:', {
        apiKeySource: defaultStatus.apiKey ? 'Default' : 'User-configured',
        bridgeUrlSource: defaultStatus.bridgeUrl ? 'Default' : 'User-configured', 
        modelSource: defaultStatus.model ? 'Default' : 'User-configured'
      });
      
    } catch (error) {
      console.error('Error loading settings:', error);
      showSnackbar('Error loading settings');
    }
  };

  const checkHealth = async () => {
    try {
      setLoading(true);
      const healthData = await mcpBridgeAPI.checkHealth();
      setHealth(healthData);
      setLoading(false);
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth(null);
      setLoading(false);
      showSnackbar('MCP Bridge connection failed');
    }
  };

  const saveMcpBridgeUrl = async () => {
    try {
      setLoading(true);
      const urlToSave = mcpBridgeUrl.trim();
      await mcpBridgeAPI.setBaseUrl(urlToSave);
      // Check health after setting URL
      await checkHealth();
      
      // Update default tracking  
      const isDefault = urlToSave === 'http://localhost:3000';
      setIsUsingDefaults(prev => ({ ...prev, bridgeUrl: isDefault }));
      
      // Update banner visibility
      const updatedDefaults = { ...isUsingDefaults, bridgeUrl: isDefault };
      const usingAnyDefaults = Object.values(updatedDefaults).some(val => val);
      setShowConfigBanner(usingAnyDefaults);
      
      console.log(`🌐 MCP Bridge URL saved: ${urlToSave} (${isDefault ? 'Default' : 'User-configured'})`);
      showSnackbar(`MCP Bridge URL saved${isDefault ? ' (using default)' : ' (custom)'}`);
      
      // Trigger re-initialization in ChatComponent
      if ((global as any).forceReInitialization) {
        (global as any).forceReInitialization();
      }
    } catch (error) {
      console.error('Failed to save MCP Bridge URL:', error);
      showSnackbar('Failed to save MCP Bridge URL');
    } finally {
      setLoading(false);
    }
  };

  const saveGeminiSettings = async () => {
    try {
      setLoading(true);
      const apiKeyToSave = geminiApiKey.trim();
      
      // Initialize with new API key
      await geminiAPI.initialize(apiKeyToSave);
      
      // Determine which model to use
      let modelToSave = selectedModelValue;
      if (selectedModelValue === 'custom') {
        modelToSave = customModelName.trim();
      }
      
      // Set the model
      const finalModel = modelToSave || 'gemini-1.5-flash';
      await geminiAPI.setModel(finalModel);
      setGeminiModel(finalModel);
      
      // Update default tracking - no hardcoded API key means it's always user-configured
      const apiKeyIsDefault = false; // No default API key
      const modelIsDefault = finalModel === 'gemini-1.5-flash';
      
      const updatedDefaults = { 
        ...isUsingDefaults, 
        apiKey: apiKeyIsDefault,
        model: modelIsDefault 
      };
      setIsUsingDefaults(updatedDefaults);
      
      // Update banner visibility
      const usingAnyDefaults = Object.values(updatedDefaults).some(val => val);
      setShowConfigBanner(usingAnyDefaults);
      
      console.log(`🤖 Gemini settings saved:`);
      console.log(`   API Key: ${apiKeyIsDefault ? 'Default' : 'User-configured'}`);
      console.log(`   Model: ${finalModel} (${modelIsDefault ? 'Default' : 'User-configured'})`);
      
      showSnackbar(`Gemini settings saved${apiKeyIsDefault ? ' (using default key)' : ' (custom key)'}`);
      
      // Trigger re-initialization in ChatComponent
      if ((global as any).forceReInitialization) {
        (global as any).forceReInitialization();
      }
    } catch (error) {
      console.error('Failed to save Gemini settings:', error);
      showSnackbar('Failed to save Gemini settings');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const handleDebugStorage = async () => {
    try {
      console.log('🔍 DEBUG: Checking AsyncStorage values...');
      
      const apiKey = await AsyncStorage.getItem('geminiApiKey');
      const bridgeUrl = await AsyncStorage.getItem('mcpBridgeUrl');
      const modelName = await AsyncStorage.getItem('geminiModelName');
      const initialConfig = await AsyncStorage.getItem('initialConfigLoaded');
      
      const debugInfo = {
        apiKey: apiKey ? `${apiKey.substring(0, 15)}... (length: ${apiKey.length})` : 'NULL',
        bridgeUrl: bridgeUrl || 'NULL',
        modelName: modelName || 'NULL',
        initialConfigLoaded: initialConfig || 'NULL',
        apiKeyStartsWithAIzaSy: apiKey ? apiKey.startsWith('AIzaSy') : false
      };
      
      console.log('🔍 DEBUG: AsyncStorage contents:', debugInfo);
      
      Alert.alert(
        'Debug Info',
        `API Key: ${debugInfo.apiKey}\nBridge URL: ${debugInfo.bridgeUrl}\nModel: ${debugInfo.modelName}\nValid Format: ${debugInfo.apiKeyStartsWithAIzaSy}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Debug failed:', error);
      Alert.alert('Debug Error', String(error));
    }
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset to Defaults',
      'This will reset all settings to the original default values. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await resetToDefaults();
              await loadSettings(); // Reload settings to reflect changes
              showSnackbar('Settings reset to defaults');
            } catch (error) {
              console.error('Failed to reset to defaults:', error);
              showSnackbar('Failed to reset settings');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getConfigurationBadge = (isDefault: boolean, type: string) => {
    return (
      <Chip 
        mode="outlined" 
        compact 
        style={[
          styles.configBadge,
          { 
            backgroundColor: isDefault ? theme.colors.tertiaryContainer : theme.colors.primaryContainer,
            borderColor: isDefault ? theme.colors.tertiary : theme.colors.primary
          }
        ]}
        textStyle={{ fontSize: 10 }}
      >
        {isDefault ? `Default ${type}` : `Custom ${type}`}
      </Chip>
    );
  };

  const getSelectedModelName = () => {
    if (selectedModelValue === 'custom') {
      return customModelName || 'Custom Model Name';
    }
    
    const model = GEMINI_MODELS.find(m => m.value === selectedModelValue);
    return model ? model.name : selectedModelValue;
  };

  const renderModelsByCategory = () => {
    const categories = ['Latest', 'Stable', 'Preview', 'Custom'];
    
    return categories.map(category => {
      const modelsInCategory = GEMINI_MODELS.filter(model => model.category === category);
      if (modelsInCategory.length === 0) return null;

      return (
        <View key={category}>
          <Text style={[styles.categoryHeader, { color: theme.colors.primary }]}>
            {category}
          </Text>
          {modelsInCategory.map((model, index) => (
            <View key={model.value}>
              <View style={styles.modelOption}>
                <View style={styles.modelOptionContent}>
                  <RadioButton value={model.value} />
                  <View style={styles.modelInfo}>
                    <View style={styles.modelNameRow}>
                      <Text style={[styles.modelName, { color: theme.colors.onSurface }]}>
                        {model.name}
                      </Text>
                      {model.isDefault && (
                        <View style={[styles.defaultBadge, { backgroundColor: theme.colors.primary }]}>
                          <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.modelDesc, { color: theme.colors.onSurface }]}>
                      {model.description}
                    </Text>
                    {model.value !== 'custom' && (
                      <Text style={[styles.modelId, { color: theme.colors.onSurface }]}>
                        {model.value}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              {index < modelsInCategory.length - 1 && <Divider />}
            </View>
          ))}
        </View>
      );
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Configuration Status Banner */}
        {showConfigBanner && (
          <Banner
            visible={showConfigBanner}
            actions={[
              {
                label: 'Reset All',
                onPress: handleResetToDefaults,
              },
              {
                label: 'Dismiss',
                onPress: () => setShowConfigBanner(false),
              },
            ]}
            icon="information-outline"
            style={{ marginBottom: 16 }}
          >
            Some settings are using default values. You can customize them or reset all to defaults.
          </Banner>
        )}

        {/* MCP Bridge Settings */}
        <Card style={[styles.card, styles.modernCard]}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="server-network" size={24} color={theme.colors.primary} />
              <Title style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                MCP Bridge Connection
              </Title>
              {getConfigurationBadge(isUsingDefaults.bridgeUrl, 'URL')}
            </View>
            <TextInput
              label="MCP Bridge URL"
              value={mcpBridgeUrl}
              onChangeText={setMcpBridgeUrl}
              mode="outlined"
              placeholder="http://localhost:3000"
              style={styles.input}
              left={<TextInput.Icon icon="link" />}
            />
            <Button
              mode="contained"
              onPress={saveMcpBridgeUrl}
              loading={loading}
              disabled={loading || !mcpBridgeUrl}
              style={styles.button}
              icon="connection"
            >
              Connect to MCP Bridge
            </Button>

            {health && (
              <View style={[styles.healthInfo, { backgroundColor: 'rgba(187, 134, 252, 0.1)' }]}>
                <View style={styles.healthHeader}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
                  <Text style={[styles.healthTitle, { color: theme.colors.onSurface }]}>
                    MCP Bridge Status
                  </Text>
                </View>
                <View style={styles.healthDetails}>
                  <Text style={[styles.healthText, { color: theme.colors.onSurface }]}>
                    Status: {health.status}
                  </Text>
                  <Text style={[styles.healthText, { color: theme.colors.onSurface }]}>
                    Server Count: {health.serverCount}
                  </Text>
                </View>
                
                {health.servers && health.servers.length > 0 && (
                  <View style={styles.serversSection}>
                    <Text style={[styles.serversTitle, { color: theme.colors.onSurface }]}>
                      Connected Servers:
                    </Text>
                    {health.servers.map((server, index) => (
                      <View key={index} style={styles.serverItem}>
                        <MaterialCommunityIcons name="server" size={16} color={theme.colors.primary} />
                        <Text style={[styles.serverText, { color: theme.colors.onSurface }]}>
                          {server.id} (Risk Level: {server.risk_level || 'N/A'})
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Gemini API Settings */}
        <Card style={[styles.card, styles.modernCard]}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="robot" size={24} color={theme.colors.primary} />
              <Title style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                Gemini API Settings
              </Title>
              {getConfigurationBadge(isUsingDefaults.apiKey, 'Key')}
            </View>
            <TextInput
              label="Gemini API Key"
              value={geminiApiKey}
              onChangeText={setGeminiApiKey}
              mode="outlined"
              secureTextEntry
              placeholder="Enter your Gemini API key"
              style={styles.input}
              left={<TextInput.Icon icon="key" />}
            />
            
            {/* Model selection UI */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.inputLabel, { color: theme.colors.onSurface }]}>
                Gemini Model
              </Text>
              {getConfigurationBadge(isUsingDefaults.model, 'Model')}
            </View>
            <TouchableOpacity 
              style={[styles.modernSelector, { borderColor: theme.colors.primary }]}
              onPress={() => setShowModelsDialog(true)}
            >
              <View style={styles.selectorContent}>
                <MaterialCommunityIcons name="brain" size={20} color={theme.colors.primary} />
                <Text style={[styles.selectorText, { color: theme.colors.onSurface }]}>
                  {getSelectedModelName()}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
            
            {selectedModelValue === 'custom' && (
              <TextInput
                label="Custom Model Name"
                value={customModelName}
                onChangeText={setCustomModelName}
                mode="outlined"
                placeholder="Enter custom model name"
                style={styles.input}
                left={<TextInput.Icon icon="pencil" />}
              />
            )}
            
            <Button
              mode="contained"
              onPress={saveGeminiSettings}
              loading={loading}
              disabled={loading || !geminiApiKey || (selectedModelValue === 'custom' && !customModelName)}
              style={styles.button}
              icon="content-save"
            >
              Save Gemini Settings
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
      
      {/* Model selection dialog */}
      <Portal>
        <Dialog 
          visible={showModelsDialog} 
          onDismiss={() => setShowModelsDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>
            Select Gemini Model
          </Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0, maxHeight: 500 }}>
            <ScrollView>
              <RadioButton.Group onValueChange={value => {
                setSelectedModelValue(value);
                setShowModelsDialog(false);
              }} value={selectedModelValue}>
                {renderModelsByCategory()}
              </RadioButton.Group>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowModelsDialog(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{ backgroundColor: theme.colors.surface }}
      >
        <Text style={{ color: theme.colors.onSurface }}>{snackbarMessage}</Text>
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 50 : 16, // Extra top padding for Android status bar
    paddingBottom: 100, // Extra space for tab bar
  },
  card: {
    marginBottom: 20,
  },
  modernCard: {
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    marginLeft: 12,
    fontSize: 20,
    fontWeight: '600',
  },
  input: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 8,
  },
  button: {
    marginTop: 8,
    borderRadius: 12,
  },
  modernSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(187, 134, 252, 0.05)',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorText: {
    marginLeft: 12,
    fontSize: 16,
    flex: 1,
  },
  healthInfo: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(187, 134, 252, 0.3)',
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  healthTitle: {
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  healthDetails: {
    marginBottom: 12,
  },
  healthText: {
    fontSize: 14,
    marginBottom: 4,
  },
  serversSection: {
    marginTop: 8,
  },
  serversTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  serverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  serverText: {
    marginLeft: 8,
    fontSize: 14,
  },
  dialog: {
    maxHeight: '80%',
  },
  categoryHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modelOption: {
    padding: 12,
  },
  modelOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modelInfo: {
    flex: 1,
    marginLeft: 12,
  },
  modelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelName: {
    fontWeight: '600',
    fontSize: 16,
    flex: 1,
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  modelDesc: {
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 4,
    lineHeight: 18,
  },
  modelId: {
    fontSize: 12,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  configBadge: {
    marginLeft: 8,
    marginBottom: 4,
  },
}); 