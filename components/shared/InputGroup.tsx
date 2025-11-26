import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, TextInput, TextInputProps } from 'react-native';

interface InputGroupProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  maxLength?: TextInputProps['maxLength'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  style?: ViewStyle;
  inputStyle?: TextStyle;
}

const InputGroup: React.FC<InputGroupProps> = ({ label, style, inputStyle, value, onChangeText, placeholder, keyboardType, maxLength, autoCapitalize, ...rest }) => {
  return (
    <View style={[styles.inputGroup, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        {...rest}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    fontFamily: 'Montserrat-Medium',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
    fontFamily: 'Montserrat-Regular',
  },
});

export default InputGroup; 