import WKApp,{ThemeMode} from "../../App";

/* eslint import/no-anonymous-default-export: [2, {"allowObject": true}] */

export default class InputStyle {

  static getStyle() {
    
    return { 
      control: {
    
        fontSize: 14,
        fontWeight: 'normal',
      },
      highlighter: {
        overflow: 'auto',
        maxHeight: 120,
        minHeight: 53,
      },
    
      input: {
        overflow: 'auto',
        maxHeight: 120,
        minHeight: 53,
      },
    
      '&singleLine': {
        control: {
          display: 'inline-block',
    
          width: 130,
        },
    
        highlighter: {
          padding: 1,
          border: '2px inset transparent',
        },
    
        input: {
          padding: 1,
    
          border: '0px inset',
        },
      },
    
      '&multiLine': {
        control: {
          fontFamily: 'monospace',
          border: '0px solid silver',
          minHeight: 53,
          maxHeight: 120,
        },
    
        highlighter: {
          padding: 9,
          maxHeight: 120,
          overflow: 'auto',
        },
    
        input: {
          padding: 10,
          minHeight: 63,
          maxHeight: 120,
          overflowY: 'auto',
          outline: 0,
          border: 0,
        },
      },
    
      suggestions: {
        list: {
          backgroundColor: "var(--wk-color-item)",
          // border: '1px solid rgba(0,0,0,0.15)',
          boxShadow: WKApp.config.themeMode === ThemeMode.dark?"15px 15px 15px -15px #000, -15px -15px 15px -15px #000":'15px 15px 15px -15px #eee, -15px -15px 15px -15px #eee',
          fontSize: 14,
          zIndex: 9999,
          padding: '5px 0px 5px 0px',
          minWidth: '420px',
          maxHeight: '220px',
          // borderRadius: '5px',
          overflowY:'auto',
          overflowX: 'hidden',
        },
    
        item: {
          zIndex: 9999,
          padding: '5px 0px',
          marginBottom: "10px",
          borderBottom: '0px solid rgba(0,0,0,0.15)',
    
          '&focused': {
            backgroundColor: '#E0540E',
          },
        },
      },
    }
  }
}
